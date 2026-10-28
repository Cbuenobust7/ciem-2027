"""Aceptación de ADR-04: la agenda la protege PostgreSQL, no Django.

Cada test comprueba un comportamiento que la `ExclusionConstraint` debe garantizar
incluso cuando la escritura **no** pasa por Django (INSERT por SQL crudo).
"""

from datetime import timedelta

import pytest
from django.db import IntegrityError, connection, transaction
from django.utils import timezone

from verticals.cleaning.bookings.errors import CleaningAPIError, SlotUnavailable
from verticals.cleaning.bookings.models import Booking, BookingEvent
from verticals.cleaning.bookings.services import create_booking

from .helpers import SLOT_START, at, make_amounts, make_service, pgcode

pytestmark = pytest.mark.django_db


def _book(user, service, start_at, **kwargs):
    booking, _ = create_booking(
        customer=user,
        listing=service.listing,
        start_at=start_at,
        address='Av. Arequipa 1234',
        district='san-borja',
        **kwargs,
    )
    return booking


def test_postgresql_rejects_overlap_written_outside_the_orm(booked_slot):
    """Un INSERT por SQL crudo que solapa debe fallar con SQLSTATE 23P01.

    Es la prueba de que la garantía es de la base de datos: si esto pasara, la
    restricción no existiría de verdad y la API podría crear dobles reservas.
    """
    source_id = booked_slot.pk
    overlapping_start = at(16)  # 11:00 Lima: solapa con 10:00–13:00
    with pytest.raises(IntegrityError) as excinfo:
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO cleaning_bookings_booking (
                        code, customer_id, account_id, resource_id, listing_id,
                        service_title, start_at, end_at, buffer_minutes,
                        occupies_until, status, address, district, price, zone_fee,
                        currency, platform_fee, provider_amount, deposit_amount,
                        payment_status, customer_notes, provider_notes,
                        cancel_reason, cancel_detail, created_at, updated_at
                    )
                    SELECT 'CL-RAW-000001', customer_id, account_id, resource_id,
                           listing_id, service_title, %s, %s, buffer_minutes, %s,
                           'confirmed', address, district, price, zone_fee,
                           currency, platform_fee, provider_amount, deposit_amount,
                           payment_status, customer_notes, provider_notes,
                           cancel_reason, cancel_detail, now(), now()
                    FROM cleaning_bookings_booking WHERE id = %s
                    """,
                    [
                        overlapping_start,
                        overlapping_start + timedelta(hours=3),
                        overlapping_start + timedelta(hours=3, minutes=30),
                        source_id,
                    ],
                )
    assert pgcode(excinfo.value) == '23P01'


def test_adjacent_slot_is_allowed_when_there_is_no_buffer(
    account, customer, other_customer,
):
    """13:00 empieza justo cuando termina 10:00–13:00 con buffer 0: debe caber."""
    service = make_service(account, buffer_minutes=0)
    _book(customer, service, at(15))   # 10:00–13:00 Lima
    _book(other_customer, service, at(18))  # 13:00–16:00 Lima
    assert Booking.objects.count() == 2


def test_adjacent_slot_is_rejected_when_the_buffer_blocks_it(
    account, customer, other_customer,
):
    """Con buffer de 30 min la reserva ocupa hasta las 13:30: 13:00 no cabe (ADR-04)."""
    service = make_service(account, buffer_minutes=30)
    _book(customer, service, at(15))   # ocupa hasta 13:30 Lima
    with pytest.raises(SlotUnavailable):
        _book(other_customer, service, at(18))  # 13:00 Lima


def test_cancelled_booking_does_not_block_the_slot(booked_slot, other_customer):
    """Una reserva cancelada sale del índice parcial y libera el horario."""
    booked_slot.status = Booking.Status.CANCELLED
    booked_slot.hold_expires_at = None
    booked_slot.cancelled_at = timezone.now()
    booked_slot.save(
        update_fields=['status', 'hold_expires_at', 'cancelled_at', 'updated_at'],
    )
    replacement = _book(other_customer, booked_slot.listing.service_details, SLOT_START)
    assert replacement.status == Booking.Status.REQUESTED


def test_same_slot_on_another_resource_is_allowed(
    booked_slot, second_resource, other_customer,
):
    """El invariante es por recurso: dos cuadrillas trabajan en paralelo."""
    booking = _book(
        other_customer, booked_slot.listing.service_details, SLOT_START,
        resource=second_resource,
    )
    assert booking.resource_id == second_resource.id
    assert Booking.objects.count() == 2


def test_expired_hold_is_released_before_inserting(account, customer, other_customer, resource, service):
    """Un hold vencido no puede bloquear: se marca `expired` y entra la nueva reserva.

    Es la comprobación del orden de §8.1: expirar **antes** del INSERT.
    """
    stale = Booking.objects.create(
        code='CL-STALE-000001',
        customer=customer,
        account=account,
        resource=resource,
        listing=service.listing,
        service_title=service.listing.title,
        start_at=SLOT_START,
        end_at=SLOT_START + timedelta(hours=3),
        buffer_minutes=30,
        occupies_until=SLOT_START + timedelta(hours=3, minutes=30),
        status=Booking.Status.REQUESTED,
        hold_expires_at=timezone.now() - timedelta(minutes=1),
        address='Av. Arequipa 1234',
        district='san-borja',
        **make_amounts(),
    )

    booking = _book(other_customer, service, SLOT_START)

    stale.refresh_from_db()
    assert stale.status == Booking.Status.EXPIRED
    assert stale.hold_expires_at is None
    assert stale.events.filter(reason='hold_expired').count() == 1
    assert booking.status == Booking.Status.REQUESTED


def test_conflict_is_reported_as_a_domain_error(booked_slot, other_customer):
    """El 23P01 se traduce a `slot_unavailable`/409, no a un error de servidor."""
    with pytest.raises(CleaningAPIError) as excinfo:
        _book(other_customer, booked_slot.listing.service_details, at(16))
    assert excinfo.value.code == 'slot_unavailable'
    assert excinfo.value.status == 409
    assert excinfo.value.as_dict()['code'] == 'slot_unavailable'


def test_booking_event_is_written_on_creation(customer, service):
    booking = _book(customer, service, SLOT_START)
    event = booking.events.get()
    assert event.from_status == ''
    assert event.to_status == Booking.Status.REQUESTED
    assert event.actor_role == 'customer'
