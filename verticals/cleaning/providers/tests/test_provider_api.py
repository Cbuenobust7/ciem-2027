import pytest
from rest_framework.test import APIClient

from verticals.cleaning.providers.models import (
    ProviderAccount,
    ProviderMembership,
    ProviderResource,
    ProviderServiceArea,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db(transaction=True)
def test_create_provider_creates_account_owner_membership_and_primary_resource(
    api_client, cleaning_owner,
):
    api_client.force_authenticate(cleaning_owner)
    response = api_client.post('/api/cleaning/providers/', {
        'display_name': 'Clean Lima', 'kind': 'company',
        'terms_accepted': True,
    }, format='json')

    assert response.status_code == 201
    account = ProviderAccount.objects.get(pk=response.data['id'])
    assert account.owner == cleaning_owner
    assert account.slug == 'clean-lima'
    assert account.memberships.get().role == ProviderMembership.Role.OWNER
    assert account.resources.get().name == 'Principal'


@pytest.mark.django_db(transaction=True)
def test_provider_creation_rolls_back_account_if_membership_creation_fails(
    api_client, cleaning_owner, monkeypatch,
):
    def fail_membership(*args, **kwargs):
        raise RuntimeError('injected membership failure')

    monkeypatch.setattr(ProviderMembership.objects, 'create', fail_membership)
    api_client.force_authenticate(cleaning_owner)
    api_client.raise_request_exception = False
    response = api_client.post('/api/cleaning/providers/', {
        'display_name': 'Atomic Provider',
        'terms_accepted': True,
    }, format='json')

    assert response.status_code == 500
    assert not ProviderAccount.objects.filter(display_name='Atomic Provider').exists()
    assert not ProviderResource.objects.filter(name='Principal').exists()


@pytest.mark.django_db
def test_directory_and_profile_are_public_and_exclude_rejected_accounts(
    api_client, provider_account,
):
    provider_account.verification_status = ProviderAccount.Verification.VERIFIED
    provider_account.save(update_fields=['verification_status'])
    visible = api_client.get('/api/cleaning/providers/')
    profile = api_client.get(f'/api/cleaning/providers/{provider_account.pk}/')

    rejected = ProviderAccount.objects.create(
        owner=provider_account.owner,
        display_name='Rejected Provider',
        verification_status=ProviderAccount.Verification.REJECTED,
    )
    directory = api_client.get('/api/cleaning/providers/')

    assert visible.status_code == 200
    assert any(item['id'] == provider_account.pk for item in visible.data['results'])
    assert profile.status_code == 200
    assert directory.status_code == 200
    assert all(item['id'] != rejected.pk for item in directory.data['results'])


@pytest.mark.django_db
def test_provider_profile_edit_is_owner_admin_only(
    api_client, provider_account, cleaning_owner, provider_admin, provider_staff,
):
    url = f'/api/cleaning/providers/{provider_account.pk}/'
    api_client.force_authenticate(provider_staff)
    denied = api_client.patch(url, {'display_name': 'Staff Edit'}, format='json')
    assert denied.status_code == 403
    provider_account.refresh_from_db()
    assert provider_account.display_name == 'Proveedor de Prueba'

    api_client.force_authenticate(provider_admin)
    allowed = api_client.patch(url, {'display_name': 'Admin Edit'}, format='json')
    assert allowed.status_code == 200
    provider_account.refresh_from_db()
    assert provider_account.display_name == 'Admin Edit'


@pytest.mark.django_db
def test_service_areas_can_be_listed_added_and_deactivated(
    api_client, provider_account, cleaning_owner, cleaning_city,
):
    api_client.force_authenticate(cleaning_owner)
    url = f'/api/cleaning/providers/{provider_account.pk}/service-areas/'
    created = api_client.post(url, {
        'city': cleaning_city.pk,
        'district': ' San-Borja ',
        'district_label': ' San Borja ',
        'extra_fee': '5.00',
    }, format='json')

    assert created.status_code == 201
    area = ProviderServiceArea.objects.get(pk=created.data['id'])
    assert area.district == 'san-borja'
    assert area.district_label == 'San Borja'
    assert api_client.get(url).status_code == 200

    deleted = api_client.delete(f'{url}{area.pk}/')
    area.refresh_from_db()
    assert deleted.status_code == 204
    assert area.is_active is False
    assert api_client.get(url).data['results'] == []


@pytest.mark.django_db
def test_provider_a_cannot_edit_provider_b_profile_or_zones(
    api_client, provider_account, cleaning_owner, cleaning_customer, cleaning_city,
):
    other = ProviderAccount.objects.create(
        owner=cleaning_customer,
        display_name='Other Provider',
    )
    api_client.force_authenticate(cleaning_owner)
    profile = api_client.patch(
        f'/api/cleaning/providers/{other.pk}/', {'display_name': 'Stolen'}, format='json',
    )
    zones = api_client.post(
        f'/api/cleaning/providers/{other.pk}/service-areas/',
        {'city': cleaning_city.pk, 'district': 'x', 'district_label': 'X'}, format='json',
    )

    # La cuenta ajena no está publicada: el detalle la trata como inexistente
    # para no revelar su existencia (404). Las zonas sí se resuelven y el
    # permiso responde 403.
    assert profile.status_code == 404
    assert zones.status_code == 403
