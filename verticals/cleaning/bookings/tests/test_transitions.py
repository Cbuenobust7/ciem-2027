"""Máquina de estados de `Booking` (§4.1) a través de la API.

Las 8 transiciones válidas y las ilegales. La regla que estos tests protegen:
ninguna vista escribe `status` a mano, así que todo pasa por los servicios y
siempre queda un `BookingEvent`.
"""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from verticals.cleaning.bookings.models import Booking, BookingEvent
from verticals.cleaning.bookings.services import create_booking
from verticals.cleaning.providers.models import ProviderMembership

from .helpers import SLOT_START

pytestmark = pytest.mark.django_db

URL = '/api/cleaning/bookings/'


@pytest.fixture
def api_client():
    return APIClient()


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


def accion(api_client, code, action):
    return api_client.post(f'{URL}{code}/{action}/', {}, format='json')


def test_confirmar_por_el_proveedor(api_client, booking, owner):
    api_client.force_authenticate(owner)

    response = accion(api_client, booking.code, 'confirm')

    assert response.status_code == 200
    assert response.json()['status'] == 'confirmed'
    assert response.json()['hold_expires_at'] is None
    booking.refresh_from_db()
    assert booking.confirmed_at is not None
    assert booking.events.filter(to_status='confirmed', actor_role='owner').count() == 1


def test_confirmar_sin_ser_del_proveedor_devuelve_403(api_client, booking, customer, other_customer):
    api_client.force_authenticate(other_customer)

    response = accion(api_client, booking.code, 'confirm')

    assert response.status_code == 403
    assert response.json()['code'] == 'forbidden_role'


def test_confirmar_con_el_bloqueo_vencido_devuelve_409(api_client, booking, owner):
    booking.hold_expires_at = timezone.now() - timedelta(minutes=1)
    booking.save(update_fields=['hold_expires_at'])
    api_client.force_authenticate(owner)

    response = accion(api_client, booking.code, 'confirm')

    assert response.status_code == 409
    assert response.json()['code'] == 'hold_expired'


def test_no_se_puede_iniciar_antes_de_la_ventana(api_client, booking, owner):
    """Transición 4: `now() >= start_at - 60 min`."""
    api_client.force_authenticate(owner)
    accion(api_client, booking.code, 'confirm')

    response = accion(api_client, booking.code, 'start')

    assert response.status_code == 409
    assert response.json()['code'] == 'invalid_transition'


def test_ciclo_completo_y_cobro_manual(api_client, booking, owner, resource):
    api_client.force_authenticate(owner)
    accion(api_client, booking.code, 'confirm')
    # Se acerca el inicio para que la transición 4 sea legal.
    booking.refresh_from_db()
    booking.start_at = timezone.now() + timedelta(minutes=5)
    booking.end_at = booking.start_at + timedelta(hours=3)
    booking.save(update_fields=['start_at', 'end_at', 'occupies_until'])

    iniciada = accion(api_client, booking.code, 'start')
    completada = accion(api_client, booking.code, 'complete')
    cobrada = accion(api_client, booking.code, 'mark-paid')

    assert iniciada.status_code == 200
    assert iniciada.json()['status'] == 'in_progress'
    assert completada.json()['status'] == 'completed'
    assert cobrada.status_code == 200
    assert cobrada.json()['payment_status'] == 'paid'
    booking.refresh_from_db()
    assert booking.payment_status == Booking.PaymentStatus.PAID
    assert booking.events.filter(event_type=BookingEvent.EventType.PAYMENT).count() == 1


def test_completar_sin_estar_en_ejecucion_devuelve_409(api_client, booking, owner):
    api_client.force_authenticate(owner)
    accion(api_client, booking.code, 'confirm')

    response = accion(api_client, booking.code, 'complete')

    assert response.status_code == 409
    assert response.json()['code'] == 'invalid_transition'


def test_el_personal_no_puede_marcar_el_cobro(api_client, booking, account, cleaning_staff):
    ProviderMembership.objects.create(
        account=account, user=cleaning_staff, role=ProviderMembership.Role.STAFF,
    )
    booking.status = Booking.Status.COMPLETED
    booking.hold_expires_at = None
    booking.completed_at = timezone.now()
    booking.save(update_fields=['status', 'hold_expires_at', 'completed_at'])
    api_client.force_authenticate(cleaning_staff)

    response = accion(api_client, booking.code, 'mark-paid')

    assert response.status_code == 403
    assert response.json()['code'] == 'forbidden_role'


def test_el_personal_si_puede_confirmar(api_client, booking, account, cleaning_staff, resource):
    ProviderMembership.objects.create(
        account=account, user=cleaning_staff, role=ProviderMembership.Role.STAFF,
    )
    api_client.force_authenticate(cleaning_staff)

    response = accion(api_client, booking.code, 'confirm')

    assert response.status_code == 200
    assert response.json()['status'] == 'confirmed'


def test_el_cliente_cancela_su_reserva(api_client, booking, customer):
    api_client.force_authenticate(customer)

    response = accion(api_client, booking.code, 'cancel')

    assert response.status_code == 200
    assert response.json()['status'] == 'cancelled'
    booking.refresh_from_db()
    assert booking.cancel_reason == 'customer'
    assert booking.cancelled_by_id == customer.id
    assert booking.hold_expires_at is None


def test_el_proveedor_rechaza_con_decline(api_client, booking, owner):
    api_client.force_authenticate(owner)

    response = accion(api_client, booking.code, 'decline')

    assert response.status_code == 200
    booking.refresh_from_db()
    assert booking.status == Booking.Status.CANCELLED
    assert booking.cancel_reason == 'provider'


def test_un_estado_terminal_no_tiene_salida(api_client, booking, owner, customer):
    api_client.force_authenticate(customer)
    accion(api_client, booking.code, 'cancel')

    api_client.force_authenticate(owner)
    response = accion(api_client, booking.code, 'confirm')

    assert response.status_code == 409
    assert response.json()['code'] == 'invalid_transition'


def test_una_reserva_en_ejecucion_solo_la_cierra_la_plataforma(
    api_client, booking, owner, cleaning_staff,
):
    ProviderMembership.objects.create(
        account=booking.account, user=cleaning_staff, role=ProviderMembership.Role.STAFF,
    )
    api_client.force_authenticate(owner)
    accion(api_client, booking.code, 'confirm')
    booking.refresh_from_db()
    booking.start_at = timezone.now() + timedelta(minutes=5)
    booking.end_at = booking.start_at + timedelta(hours=3)
    booking.save(update_fields=['start_at', 'end_at', 'occupies_until'])
    accion(api_client, booking.code, 'start')

    api_client.force_authenticate(owner)
    rechazada = accion(api_client, booking.code, 'cancel')

    plataforma = booking.customer
    plataforma.is_staff = True
    plataforma.save(update_fields=['is_staff'])
    api_client.force_authenticate(plataforma)
    aceptada = accion(api_client, booking.code, 'cancel')

    assert rechazada.status_code == 403
    assert rechazada.json()['code'] == 'forbidden_role'
    assert aceptada.status_code == 200
    assert aceptada.json()['status'] == 'cancelled'
    booking.refresh_from_db()
    assert booking.cancel_reason == 'incident'


def test_accion_desconocida_devuelve_404(api_client, booking, owner):
    api_client.force_authenticate(owner)

    response = accion(api_client, booking.code, 'teletransportar')

    assert response.status_code == 404
    assert response.json()['code'] == 'not_found'
