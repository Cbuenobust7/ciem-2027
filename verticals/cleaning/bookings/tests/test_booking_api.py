"""API de creación y consulta de reservas (§5.1, §5.2, §5.3, §8.1)."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from verticals.cleaning.bookings.models import Booking
from verticals.cleaning.providers.models import ProviderAccount, ProviderResource
from verticals.cleaning.services.models import ServiceDetails

from .helpers import SLOT_START

pytestmark = pytest.mark.django_db

URL = '/api/cleaning/bookings/'


@pytest.fixture
def api_client():
    return APIClient()


def payload(listing, **overrides):
    data = {
        'listing': listing.pk,
        'start_at': SLOT_START.isoformat(),
        'address': 'Av. Arequipa 1234, dpto 501',
        'district': 'san-borja',
        'customer_notes': 'Llamar al llegar, hay portero',
    }
    data.update(overrides)
    return data


# ---------------------------------------------------------------------------
# Alta
# ---------------------------------------------------------------------------
def test_crear_reserva_devuelve_201_con_la_forma_del_contrato(api_client, customer, service):
    api_client.force_authenticate(customer)

    response = api_client.post(URL, payload(service.listing), format='json')

    assert response.status_code == 201
    data = response.json()
    assert set(data) == {
        'code', 'status', 'hold_expires_at', 'start_at', 'end_at',
        'occupies_until', 'service', 'account', 'resource', 'price',
        'zone_fee', 'currency', 'platform_fee', 'provider_amount',
        'deposit_amount', 'payment_status',
    }
    assert data['code'].startswith('CL-')
    assert data['status'] == 'requested'
    assert data['hold_expires_at'] is not None
    assert data['service'] == {
        'listing': service.listing_id,
        'title': service.listing.title,
        'duration_minutes': 180,
        'buffer_minutes': 30,
    }
    assert data['account'] == {
        'id': service.provider_account_id, 'display_name': 'CleanHome Lima',
    }
    assert data['resource']['name'] == 'Principal'
    # ADR-08: los importes los fija el servidor, no la petición.
    assert data['price'] == '120.00'
    assert data['platform_fee'] == '12.00'
    assert data['provider_amount'] == '108.00'
    assert data['zone_fee'] == '0.00'
    assert data['currency'] == 'PEN'
    assert data['payment_status'] == 'unpaid'


def test_sin_autenticacion_devuelve_401(api_client, service):
    response = api_client.post(URL, payload(service.listing), format='json')

    assert response.status_code == 401
    assert response.json()['code'] == 'not_authenticated'


def test_distrito_no_cubierto_devuelve_422(api_client, customer, service):
    api_client.force_authenticate(customer)

    response = api_client.post(
        URL, payload(service.listing, district='miraflores'), format='json',
    )

    assert response.status_code == 422
    assert response.json()['code'] == 'outside_service_area'


def test_aviso_minimo_devuelve_422(api_client, customer, service):
    api_client.force_authenticate(customer)

    response = api_client.post(
        URL,
        payload(service.listing, start_at=(timezone.now() + timedelta(hours=1)).isoformat()),
        format='json',
    )

    assert response.status_code == 422
    assert response.json()['code'] == 'too_soon'


def test_fuera_del_horizonte_devuelve_422(api_client, customer, service):
    api_client.force_authenticate(customer)

    response = api_client.post(
        URL,
        payload(service.listing, start_at=(timezone.now() + timedelta(days=90)).isoformat()),
        format='json',
    )

    assert response.status_code == 422
    assert response.json()['code'] == 'beyond_horizon'


def test_cuenta_no_verificada_devuelve_422(api_client, customer, service):
    account = service.provider_account
    account.verification_status = ProviderAccount.Verification.PENDING
    account.save(update_fields=['verification_status'])
    api_client.force_authenticate(customer)

    response = api_client.post(URL, payload(service.listing), format='json')

    assert response.status_code == 422
    assert response.json()['code'] == 'provider_not_verified'


def test_servicio_pausado_devuelve_422(api_client, customer, service):
    service.listing.status = 'paused'
    service.listing.save(update_fields=['status'])
    api_client.force_authenticate(customer)

    response = api_client.post(URL, payload(service.listing), format='json')

    assert response.status_code == 422
    assert response.json()['code'] == 'service_inactive'


def test_recurso_de_otra_cuenta_devuelve_422(
    api_client, customer, service, other_customer,
):
    ajena = ProviderAccount.objects.create(
        owner=other_customer, display_name='Otra cuenta',
        verification_status=ProviderAccount.Verification.VERIFIED,
    )
    ajeno = ajena.resources.get(name='Principal')
    api_client.force_authenticate(customer)

    response = api_client.post(
        URL, payload(service.listing, resource=ajeno.pk), format='json',
    )

    assert response.status_code == 422
    assert response.json()['code'] == 'resource_unavailable'


def test_sin_recurso_el_servidor_elige_el_primero_libre(
    api_client, customer, service, resource, second_resource,
):
    """§5.2: una empresa con varias cuadrillas no obliga al cliente a elegir."""
    api_client.force_authenticate(customer)
    primera = api_client.post(
        URL, payload(service.listing, resource=resource.pk), format='json',
    )
    assert primera.status_code == 201

    segunda = api_client.post(URL, payload(service.listing), format='json')

    assert segunda.status_code == 201
    assert segunda.json()['resource']['id'] == second_resource.pk


def test_recurso_ocupado_devuelve_409(api_client, customer, other_customer, service, resource):
    api_client.force_authenticate(customer)
    assert api_client.post(
        URL, payload(service.listing, resource=resource.pk), format='json',
    ).status_code == 201

    api_client.force_authenticate(other_customer)
    response = api_client.post(
        URL, payload(service.listing, resource=resource.pk), format='json',
    )

    assert response.status_code == 409
    assert response.json()['code'] == 'slot_unavailable'
    assert response.json()['detail']


# ---------------------------------------------------------------------------
# Idempotencia (§5.3)
# ---------------------------------------------------------------------------
def test_misma_clave_y_misma_peticion_devuelve_200_con_la_misma_reserva(api_client, customer, service):
    api_client.force_authenticate(customer)
    headers = {'HTTP_IDEMPOTENCY_KEY': 'reintento-1'}

    primera = api_client.post(URL, payload(service.listing), format='json', **headers)
    segunda = api_client.post(URL, payload(service.listing), format='json', **headers)

    assert primera.status_code == 201
    assert segunda.status_code == 200
    assert primera.json()['code'] == segunda.json()['code']
    assert Booking.objects.count() == 1


def test_misma_clave_con_otra_peticion_devuelve_409(api_client, customer, service):
    api_client.force_authenticate(customer)
    headers = {'HTTP_IDEMPOTENCY_KEY': 'reintento-2'}
    api_client.post(URL, payload(service.listing), format='json', **headers)

    response = api_client.post(
        URL,
        payload(service.listing, start_at=(SLOT_START + timedelta(hours=3)).isoformat()),
        format='json',
        **headers,
    )

    assert response.status_code == 409
    assert response.json()['code'] == 'idempotency_key_reused'


# ---------------------------------------------------------------------------
# Consulta y aislamiento
# ---------------------------------------------------------------------------
def test_listado_solo_muestra_las_reservas_propias(api_client, customer, other_customer, service):
    api_client.force_authenticate(customer)
    api_client.post(URL, payload(service.listing), format='json')

    api_client.force_authenticate(other_customer)
    ajeno = api_client.get(URL)

    api_client.force_authenticate(customer)
    propio = api_client.get(URL)

    assert ajeno.status_code == 200
    assert ajeno.json()['count'] == 0
    assert propio.json()['count'] == 1


def test_detalle_incluye_el_historial_de_eventos(api_client, customer, service):
    api_client.force_authenticate(customer)
    code = api_client.post(URL, payload(service.listing), format='json').json()['code']

    response = api_client.get(f'{URL}{code}/')

    assert response.status_code == 200
    data = response.json()
    assert data['address'] == 'Av. Arequipa 1234, dpto 501'
    assert data['district'] == 'san-borja'
    assert len(data['events']) == 1
    assert data['events'][0]['to_status'] == 'requested'
    assert data['events'][0]['actor_role'] == 'customer'


def test_detalle_de_reserva_inexistente_devuelve_404(api_client, customer):
    api_client.force_authenticate(customer)

    response = api_client.get(f'{URL}CL-2026-999999/')

    assert response.status_code == 404
    assert response.json()['code'] == 'not_found'


def test_detalle_de_reserva_ajena_devuelve_403_not_participant(
    api_client, customer, other_customer, service,
):
    api_client.force_authenticate(customer)
    code = api_client.post(URL, payload(service.listing), format='json').json()['code']

    api_client.force_authenticate(other_customer)
    response = api_client.get(f'{URL}{code}/')

    assert response.status_code == 403
    assert response.json()['code'] == 'not_participant'


def test_los_errores_de_reservas_tienen_forma_uniforme(api_client, customer):
    api_client.force_authenticate(customer)

    response = api_client.post(URL, {}, format='json')

    assert response.status_code == 400
    assert response.json()['code'] == 'validation_error'
    assert set(response.json()) == {'code', 'detail', 'extra'}


def test_servicio_sin_detalles_devuelve_404(api_client, customer, service, owner):
    from decimal import Decimal

    from marketplace.listings.models import Listing

    listing = Listing.objects.create(
        seller=owner, title='Anuncio normal', description='x',
        price=Decimal('10.00'), currency='PEN', status='active',
    )
    api_client.force_authenticate(customer)

    response = api_client.post(
        URL, payload(listing), format='json',
    )

    assert response.status_code == 404
    assert response.json()['code'] == 'not_found'
