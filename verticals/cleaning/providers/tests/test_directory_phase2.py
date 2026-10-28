"""Fase 2 — modalidad de directorio, reclamaciones y correcciones.

Cubre los criterios de la especificación §2, §4, §5 y §10 que no existían antes:
fichas sin cuenta, reclamación que no verifica, publicación y retirada.
"""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from marketplace.listings.models import Listing
from verticals.cleaning.bookings.models import Booking
from verticals.cleaning.bookings.tests.helpers import SLOT_START
from verticals.cleaning.providers.models import (
    DirectoryCorrectionRequest,
    ProviderAccount,
    ProviderClaim,
    ProviderMembership,
    ProviderServiceArea,
    ProviderStatusEvent,
)
from verticals.cleaning.services.models import ServiceDetails

pytestmark = pytest.mark.django_db

PROVIDERS = '/api/cleaning/providers/'


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def cleaning_staff_user(db):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.create_user(
        username='cleaning-platform-admin',
        email='platform-admin@test.local',
        password='test-pass-1234',
        is_staff=True,
    )


@pytest.fixture
def directory_account(cleaning_city, cleaning_category):
    """Ficha informativa sin cuenta operativa (§2)."""
    account = ProviderAccount.objects.create(
        owner=None,
        display_name='Brillo Directorio',
        kind=ProviderAccount.Kind.COMPANY,
        description='Empresa de limpieza de fachadas y oficinas.',
        participation_status=ProviderAccount.Participation.DIRECTORY,
        is_published=True,
        phone='+51 999 111 222',
        contact_email='contacto@brillo.test',
        address='Av. Javier Prado 100, San Isidro',
        website='https://brillo.test',
        services_summary='Limpieza de fachadas, oficinas y vidrios.',
        source_name='Directorio público de prueba',
        source_url='https://example.test/brillo',
        last_reviewed_at=timezone.now(),
    )
    account.service_categories.add(cleaning_category)
    ProviderServiceArea.objects.create(
        account=account,
        city=cleaning_city,
        district='san-isidro',
        district_label='San Isidro',
    )
    return account


@pytest.fixture
def verified_partner(verified_provider_account):
    verified_provider_account.participation_status = (
        ProviderAccount.Participation.VERIFIED_PARTNER
    )
    verified_provider_account.save(update_fields=['participation_status'])
    return verified_provider_account


def _claim_payload(**overrides):
    data = {
        'contact_email': 'dueno@brillo.test',
        'contact_phone': '+51 999 111 222',
        'message': 'Soy el representante legal de Brillo Directorio.',
        'terms_accepted': True,
    }
    data.update(overrides)
    return data


def _booking_payload(listing):
    return {
        'listing': listing.pk,
        'start_at': SLOT_START.isoformat(),
        'address': 'Av. Arequipa 1234',
        'district': 'san-isidro',
    }


# ---------------------------------------------------------------------------
# Ficha pública sin cuenta
# ---------------------------------------------------------------------------
def test_directory_without_account_is_public_and_informative(
    api_client, directory_account,
):
    listing = api_client.get(PROVIDERS)
    detail = api_client.get(f'{PROVIDERS}{directory_account.pk}/')

    assert listing.status_code == 200
    item = next(
        row for row in listing.json()['results']
        if row['id'] == directory_account.pk
    )
    assert item['participation_status'] == 'directory'
    assert item['is_informative'] is True
    assert item['can_book'] is False
    assert item['service_categories'][0]['slug'] == 'limpieza-profunda'

    assert detail.status_code == 200
    body = detail.json()
    assert body['is_informative'] is True
    assert body['can_book'] is False
    assert body['services'] == []
    assert body['services_summary'].startswith('Limpieza de fachadas')
    assert body['address'] == 'Av. Javier Prado 100, San Isidro'
    # Los datos internos de procedencia no salen por la API pública.
    for private in (
        'internal_notes', 'source_name', 'source_url', 'reviewed_by',
        'terms_accepted_at', 'media_source',
    ):
        assert private not in body


def test_directory_search_by_name_modality_and_service_category(
    api_client, directory_account, provider_account,
):
    by_name = api_client.get(PROVIDERS, {'q': 'Brillo'})
    by_modality = api_client.get(PROVIDERS, {'modality': 'partners'})
    by_category = api_client.get(PROVIDERS, {'service_category': 'limpieza-profunda'})

    assert [row['id'] for row in by_name.json()['results']] == [directory_account.pk]
    assert all(
        row['participation_status'] in {'partner', 'verified_partner'}
        for row in by_modality.json()['results']
    )
    assert directory_account.pk in [
        row['id'] for row in by_category.json()['results']
    ]


def test_unpublished_directory_is_not_public(api_client, directory_account):
    directory_account.is_published = False
    directory_account.save(update_fields=['is_published'])

    assert api_client.get(PROVIDERS).json()['results'] == []
    assert api_client.get(f'{PROVIDERS}{directory_account.pk}/').status_code == 404


def test_directory_cannot_create_operational_data(
    api_client, directory_account, cleaning_staff_user, cleaning_city,
    cleaning_category, cleaning_customer, cleaning_owner,
):
    api_client.force_authenticate(cleaning_staff_user)

    area = api_client.post(
        f'{PROVIDERS}{directory_account.pk}/service-areas/',
        {
            'city': cleaning_city.pk,
            'district': 'miraflores',
            'district_label': 'Miraflores',
        },
        format='json',
    )
    resource = api_client.post(
        f'{PROVIDERS}{directory_account.pk}/resources/',
        {'name': 'Cuadrilla'},
        format='json',
    )
    service = api_client.post(
        '/api/cleaning/services/',
        {
            'provider_account': directory_account.pk,
            'title': 'Limpieza de fachada',
            'description': 'Servicio de prueba',
            'price': '150.00',
            'currency': 'PEN',
            'category': cleaning_category.pk,
            'duration_minutes': 120,
            'buffer_minutes': 30,
        },
        format='json',
    )

    assert area.status_code == 403
    assert area.json()['code'] == 'provider_not_operational'
    assert resource.status_code == 403
    assert resource.json()['code'] == 'provider_not_operational'
    assert service.status_code == 403
    assert service.json()['code'] == 'provider_not_operational'

    # Aunque se cree el servicio por fuera de la API, la reserva se rechaza.
    listing = Listing.objects.create(
        seller=cleaning_owner,
        title='Servicio no operativo',
        description='Prueba',
        price=Decimal('100.00'),
        currency='PEN',
        status='active',
    )
    ServiceDetails.objects.create(
        listing=listing,
        provider_account=directory_account,
        duration_minutes=60,
        buffer_minutes=0,
    )
    api_client.force_authenticate(cleaning_customer)
    booking = api_client.post(
        '/api/cleaning/bookings/', _booking_payload(listing), format='json',
    )
    assert booking.status_code == 422
    assert booking.json()['code'] == 'provider_not_verified'


# ---------------------------------------------------------------------------
# Reclamaciones
# ---------------------------------------------------------------------------
def test_claim_creates_claimed_and_admin_approval_makes_partner_not_verified(
    api_client, directory_account, cleaning_customer, cleaning_staff_user,
):
    api_client.force_authenticate(cleaning_customer)
    claim = api_client.post(
        f'{PROVIDERS}{directory_account.pk}/claim/',
        _claim_payload(),
        format='json',
    )

    assert claim.status_code == 201
    directory_account.refresh_from_db()
    assert directory_account.participation_status == 'claimed'
    assert directory_account.owner_id is None
    assert ProviderClaim.objects.get(pk=claim.json()['id']).status == 'pending'

    api_client.force_authenticate(cleaning_staff_user)
    approved = api_client.post(
        f'/api/cleaning/admin/claims/{claim.json()["id"]}/approve/',
        {'decision_note': 'Documentación revisada.'},
        format='json',
    )

    assert approved.status_code == 200
    assert approved.json()['status'] == 'approved'
    directory_account.refresh_from_db()
    assert directory_account.participation_status == 'partner'
    assert directory_account.owner_id == cleaning_customer.id
    assert directory_account.verification_status == 'pending'
    assert directory_account.verified_at is None
    assert directory_account.is_published is True
    assert ProviderMembership.objects.get(
        account=directory_account, user=cleaning_customer,
    ).role == ProviderMembership.Role.OWNER
    assert directory_account.resources.filter(name='Principal').exists()
    # Reclamar no verifica: el distintivo sigue siendo "partner".
    assert directory_account.participation_status != 'verified_partner'
    assert ProviderStatusEvent.objects.filter(
        account=directory_account,
    ).count() >= 2


def test_rejected_claim_returns_to_directory_without_owner(
    api_client, directory_account, cleaning_customer, cleaning_staff_user,
):
    api_client.force_authenticate(cleaning_customer)
    claim = api_client.post(
        f'{PROVIDERS}{directory_account.pk}/claim/',
        _claim_payload(),
        format='json',
    )
    api_client.force_authenticate(cleaning_staff_user)
    rejected = api_client.post(
        f'/api/cleaning/admin/claims/{claim.json()["id"]}/reject/',
        {'decision_note': 'No acreditó representación.'},
        format='json',
    )

    assert rejected.status_code == 200
    directory_account.refresh_from_db()
    assert directory_account.participation_status == 'directory'
    assert directory_account.owner_id is None
    assert ProviderClaim.objects.get(pk=claim.json()['id']).status == 'rejected'


def test_claim_requires_authentication_and_terms(api_client, directory_account, cleaning_customer):
    anonymous = api_client.post(
        f'{PROVIDERS}{directory_account.pk}/claim/', _claim_payload(), format='json',
    )
    assert anonymous.status_code in (401, 403)

    api_client.force_authenticate(cleaning_customer)
    no_terms = api_client.post(
        f'{PROVIDERS}{directory_account.pk}/claim/',
        _claim_payload(terms_accepted=False),
        format='json',
    )
    assert no_terms.status_code == 400


def test_only_staff_can_approve_claim(
    api_client, directory_account, cleaning_customer, cleaning_owner,
):
    api_client.force_authenticate(cleaning_customer)
    claim = api_client.post(
        f'{PROVIDERS}{directory_account.pk}/claim/',
        _claim_payload(),
        format='json',
    )
    api_client.force_authenticate(cleaning_owner)
    denied = api_client.post(
        f'/api/cleaning/admin/claims/{claim.json()["id"]}/approve/',
        format='json',
    )
    assert denied.status_code == 403
    directory_account.refresh_from_db()
    assert directory_account.participation_status == 'claimed'


# ---------------------------------------------------------------------------
# Correcciones y retirada
# ---------------------------------------------------------------------------
def test_public_correction_request_and_admin_resolution(
    api_client, directory_account, cleaning_staff_user,
):
    response = api_client.post(
        f'{PROVIDERS}{directory_account.pk}/corrections/',
        {
            'kind': 'correction',
            'requester_name': 'María Pérez',
            'requester_email': 'maria@example.test',
            'message': 'El teléfono de la ficha está desactualizado.',
        },
        format='json',
    )
    assert response.status_code == 201
    request_id = response.json()['id']
    assert DirectoryCorrectionRequest.objects.get(pk=request_id).status == 'pending'

    api_client.force_authenticate(cleaning_staff_user)
    resolved = api_client.post(
        f'/api/cleaning/admin/corrections/{request_id}/resolve/',
        {'resolution_note': 'Teléfono actualizado.'},
        format='json',
    )
    assert resolved.status_code == 200
    assert resolved.json()['status'] == 'resolved'
    directory_account.refresh_from_db()
    assert directory_account.participation_status == 'directory'


def test_approved_removal_hides_the_directory_card(
    api_client, directory_account, cleaning_staff_user,
):
    response = api_client.post(
        f'{PROVIDERS}{directory_account.pk}/corrections/',
        {
            'kind': 'removal',
            'requester_name': 'Titular de la empresa',
            'requester_email': 'titular@brillo.test',
            'message': 'Solicito retirar la ficha del directorio público.',
        },
        format='json',
    )
    request_id = response.json()['id']

    api_client.force_authenticate(cleaning_staff_user)
    resolved = api_client.post(
        f'/api/cleaning/admin/corrections/{request_id}/resolve/',
        {'resolution_note': 'Retirada aprobada.'},
        format='json',
    )

    assert resolved.status_code == 200
    directory_account.refresh_from_db()
    assert directory_account.participation_status == 'removed'
    assert directory_account.is_published is False
    api_client.force_authenticate(None)
    assert api_client.get(PROVIDERS).json()['results'] == []
    assert api_client.get(f'{PROVIDERS}{directory_account.pk}/').status_code == 404


# ---------------------------------------------------------------------------
# Publicación, suspensión y alta de asociado
# ---------------------------------------------------------------------------
def test_admin_publish_and_audit(api_client, directory_account, cleaning_staff_user):
    directory_account.is_published = False
    directory_account.save(update_fields=['is_published'])
    api_client.force_authenticate(cleaning_staff_user)

    response = api_client.post(
        f'/api/cleaning/admin/providers/{directory_account.pk}/publish/',
        {'is_published': True},
        format='json',
    )

    assert response.status_code == 200
    directory_account.refresh_from_db()
    assert directory_account.is_published is True
    assert directory_account.last_reviewed_at is not None
    assert ProviderStatusEvent.objects.filter(
        account=directory_account,
        event_type=ProviderStatusEvent.EventType.PUBLICATION,
    ).exists()
    assert api_client.get(PROVIDERS).json()['results'][0]['id'] == directory_account.pk


def test_suspended_partner_is_hidden_and_cannot_receive_bookings(
    api_client, verified_partner, cleaning_service, cleaning_customer,
):
    verified_partner.participation_status = ProviderAccount.Participation.SUSPENDED
    verified_partner.save(update_fields=['participation_status'])

    assert api_client.get(f'{PROVIDERS}{verified_partner.pk}/').status_code == 404
    assert api_client.get(
        f'{PROVIDERS}{verified_partner.pk}/availability/',
        {
            'service': cleaning_service.pk,
            'from': (timezone.localdate() + timedelta(days=2)).isoformat(),
            'to': (timezone.localdate() + timedelta(days=2)).isoformat(),
        },
    ).status_code == 404

    api_client.force_authenticate(cleaning_customer)
    booking = api_client.post(
        '/api/cleaning/bookings/',
        _booking_payload(cleaning_service),
        format='json',
    )
    assert booking.status_code == 422
    assert booking.json()['code'] == 'provider_not_verified'


def test_signup_requires_terms_and_creates_published_partner(
    api_client, cleaning_customer,
):
    api_client.force_authenticate(cleaning_customer)
    missing = api_client.post(
        PROVIDERS,
        {'display_name': 'Sin condiciones'},
        format='json',
    )
    assert missing.status_code == 400

    created = api_client.post(
        PROVIDERS,
        {
            'display_name': 'Asociado Nuevo',
            'kind': 'company',
            'terms_accepted': True,
        },
        format='json',
    )
    assert created.status_code == 201
    account = ProviderAccount.objects.get(pk=created.json()['id'])
    assert account.participation_status == 'partner'
    assert account.is_published is True
    assert account.terms_accepted_at is not None
    assert account.terms_version
    assert account.memberships.get(user=cleaning_customer).role == 'owner'
    assert account.resources.filter(name='Principal').exists()
    assert Booking.objects.count() == 0


# ---------------------------------------------------------------------------
# Bandejas administrativas y auditoría
# ---------------------------------------------------------------------------
def test_admin_provider_list_is_staff_only_and_includes_provenance(
    api_client, directory_account, cleaning_customer, cleaning_staff_user,
):
    api_client.force_authenticate(cleaning_customer)
    denied = api_client.get('/api/cleaning/admin/providers/')
    assert denied.status_code == 403

    api_client.force_authenticate(cleaning_staff_user)
    response = api_client.get('/api/cleaning/admin/providers/')
    assert response.status_code == 200
    row = response.json()['results'][0]
    assert row['participation_status'] == 'directory'
    assert row['source_name'] == 'Directorio público de prueba'
    assert row['internal_notes'] == ''


def test_admin_claim_and_audit_queues(
    api_client, directory_account, cleaning_customer, cleaning_staff_user,
):
    api_client.force_authenticate(cleaning_customer)
    api_client.post(
        f'{PROVIDERS}{directory_account.pk}/claim/',
        _claim_payload(),
        format='json',
    )

    api_client.force_authenticate(cleaning_staff_user)
    claims = api_client.get('/api/cleaning/admin/claims/')
    audit = api_client.get(
        '/api/cleaning/admin/audit/',
        {'account': directory_account.pk},
    )

    assert claims.status_code == 200
    assert claims.json()['results'][0]['status'] == 'pending'
    assert audit.status_code == 200
    assert audit.json()['results'][0]['event_type'] == 'claim'
