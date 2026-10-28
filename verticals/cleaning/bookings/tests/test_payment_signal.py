"""Señales de pago sobre reservas (§11.2).

Lo que estos tests protegen: un pago de tipo `booking` confirma la reserva
(transición 1 desde el sistema), y un pago de **otro** tipo no toca ninguna
reserva. Un hold vencido no se confirma por pagar: el dinero se registra, pero
el bloqueo ya no existía.
"""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from creatorhub_core.payments_core.models import Payment
from creatorhub_core.payments_core.signals import payment_completed
from verticals.cleaning.bookings.models import Booking
from verticals.cleaning.bookings.services import create_booking

from .helpers import SLOT_START

pytestmark = pytest.mark.django_db


@pytest.fixture
def booking(customer, service):
    reserva, _ = create_booking(
        customer=customer,
        listing=service.listing,
        start_at=SLOT_START,
        address='Av. Arequipa 1234',
        district='san-borja',
    )
    return reserva


def make_payment(*, payer, amount, payment_type, reference=''):
    return Payment.objects.create(
        payer=payer,
        amount=Decimal(amount),
        currency='PEN',
        payment_type=payment_type,
        status='completed',
        gateway='mercadopago',
        external_reference=reference,
    )


def test_un_pago_de_reserva_la_confirma(booking, customer):
    pago = make_payment(
        payer=customer, amount='120.00', payment_type='booking',
        reference=booking.code,
    )

    payment_completed.send(sender=Payment, payment=pago)

    booking.refresh_from_db()
    assert booking.status == Booking.Status.CONFIRMED
    assert booking.hold_expires_at is None
    assert booking.confirmed_at is not None
    assert booking.payment_id == pago.id
    assert booking.payment_status == Booking.PaymentStatus.PAID
    assert booking.events.filter(reason='payment_completed').count() == 1


def test_un_pago_de_visibilidad_no_toca_ninguna_reserva(booking, customer):
    pago = make_payment(
        payer=customer, amount='120.00', payment_type='visibility',
        reference=booking.code,
    )

    payment_completed.send(sender=Payment, payment=pago)

    booking.refresh_from_db()
    assert booking.status == Booking.Status.REQUESTED
    assert booking.payment_id is None
    assert booking.payment_status == Booking.PaymentStatus.UNPAID


def test_pagar_un_hold_vencido_registra_el_dinero_pero_no_confirma(booking, customer):
    booking.hold_expires_at = timezone.now() - timedelta(minutes=1)
    booking.save(update_fields=['hold_expires_at'])
    pago = make_payment(
        payer=customer, amount='120.00', payment_type='booking',
        reference=booking.code,
    )

    payment_completed.send(sender=Payment, payment=pago)

    booking.refresh_from_db()
    assert booking.status == Booking.Status.REQUESTED
    assert booking.hold_expires_at is not None
    assert booking.payment_status == Booking.PaymentStatus.PAID


def test_un_pago_sin_reserva_asociada_no_hace_nada(booking, customer):
    pago = make_payment(
        payer=customer, amount='120.00', payment_type='booking',
        reference='CL-2026-000000',
    )

    payment_completed.send(sender=Payment, payment=pago)

    booking.refresh_from_db()
    assert booking.status == Booking.Status.REQUESTED
    assert booking.payment_id is None
