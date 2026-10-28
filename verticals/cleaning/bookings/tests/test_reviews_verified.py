"""Reseña verificada atada a una reserva completada (ADR-09, §11.2).

Sin reserva se puede seguir reseñando (el paquete base es un marketplace de
productos), pero esa reseña **no** es verificada ni alimenta la reputación de la
cuenta; con reserva completada sí, y solo una vez por reserva.
"""

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from marketplace.reviews.models import Review
from verticals.cleaning.bookings.models import Booking
from verticals.cleaning.bookings.services import create_booking
from verticals.cleaning.providers.models import ProviderAccount

from .helpers import SLOT_START

pytestmark = pytest.mark.django_db

URL = '/api/reviews/'


@pytest.fixture
def api_client():
    return APIClient()


def completar(booking):
    booking.status = Booking.Status.COMPLETED
    booking.hold_expires_at = None
    booking.completed_at = timezone.now()
    booking.save(update_fields=['status', 'hold_expires_at', 'completed_at'])
    return booking


@pytest.fixture
def completed_booking(customer, service):
    reserva, _ = create_booking(
        customer=customer,
        listing=service.listing,
        start_at=SLOT_START,
        address='Av. Arequipa 1234',
        district='san-borja',
    )
    return completar(reserva)


def test_resena_sin_reserva_sigue_funcionando_pero_no_es_verificada(
    api_client, customer, service,
):
    api_client.force_authenticate(customer)

    response = api_client.post(
        URL,
        {'listing': service.listing_id, 'rating': 5, 'comment': 'Muy bien'},
        format='json',
    )

    assert response.status_code == 201
    assert response.json()['is_verified'] is False
    assert response.json()['booking_code'] is None


def test_resena_de_reserva_completada_es_verificada(
    api_client, customer, completed_booking, owner,
):
    api_client.force_authenticate(customer)

    response = api_client.post(
        URL,
        {'booking': completed_booking.pk, 'rating': 5, 'comment': 'Impecable'},
        format='json',
    )

    assert response.status_code == 201
    data = response.json()
    assert data['is_verified'] is True
    assert data['booking_code'] == completed_booking.code
    assert data['reviewer'] == customer.pk
    # El vendedor legado y el anuncio salen de la reserva, no del cliente.
    assert data['seller'] == owner.pk
    assert data['listing'] == completed_booking.listing_id


def test_resena_de_reserva_sin_completar_se_rechaza(api_client, customer, service):
    reserva, _ = create_booking(
        customer=customer,
        listing=service.listing,
        start_at=SLOT_START,
        address='Av. Arequipa 1234',
        district='san-borja',
    )
    api_client.force_authenticate(customer)

    response = api_client.post(
        URL, {'booking': reserva.pk, 'rating': 5}, format='json',
    )

    assert response.status_code == 400
    assert 'booking' in str(response.json())


def test_una_reserva_solo_se_resena_una_vez(api_client, customer, completed_booking):
    api_client.force_authenticate(customer)
    api_client.post(
        URL, {'booking': completed_booking.pk, 'rating': 5}, format='json',
    )

    response = api_client.post(
        URL, {'booking': completed_booking.pk, 'rating': 3}, format='json',
    )

    assert response.status_code == 422
    assert response.json()['code'] == 'already_reviewed'
    assert Review.objects.filter(booking=completed_booking).count() == 1


def test_no_se_puede_resenar_la_reserva_de_otro(
    api_client, other_customer, completed_booking,
):
    api_client.force_authenticate(other_customer)

    response = api_client.post(
        URL, {'booking': completed_booking.pk, 'rating': 5}, format='json',
    )

    assert response.status_code == 400
    assert 'booking' in str(response.json())


def test_la_reputacion_de_la_cuenta_solo_cuenta_resenas_verificadas(
    api_client, customer, other_customer, completed_booking, service, account,
):
    api_client.force_authenticate(customer)
    api_client.post(
        URL, {'booking': completed_booking.pk, 'rating': 5}, format='json',
    )
    # Reseña genérica del mismo anuncio, de otro usuario: no es verificada.
    api_client.force_authenticate(other_customer)
    api_client.post(
        URL, {'listing': service.listing_id, 'rating': 1}, format='json',
    )

    account.refresh_from_db()
    assert account.rating_count == 1
    assert str(account.rating_avg) == '5.00'


def test_borrar_la_resena_actualiza_el_agregado(
    api_client, customer, completed_booking, account,
):
    api_client.force_authenticate(customer)
    review_id = api_client.post(
        URL, {'booking': completed_booking.pk, 'rating': 4}, format='json',
    ).json()['id']
    account.refresh_from_db()
    assert account.rating_count == 1

    api_client.delete(f'{URL}{review_id}/')

    account.refresh_from_db()
    assert account.rating_count == 0
    assert str(account.rating_avg) == '0.00'


def test_la_verificacion_no_la_decide_el_cliente(
    api_client, customer, service,
):
    """`is_verified` es de solo lectura: mandarlo en la petición no sirve."""
    api_client.force_authenticate(customer)

    response = api_client.post(
        URL,
        {'listing': service.listing_id, 'rating': 5, 'is_verified': True},
        format='json',
    )

    assert response.status_code == 201
    assert response.json()['is_verified'] is False
    assert ProviderAccount.objects.get(pk=service.provider_account_id).rating_count == 0
