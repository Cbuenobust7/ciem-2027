"""Entrega C — el proveedor puede volver a pedir la verificación.

Contexto del agujero que cierra: `ProviderDetailView` **excluye del queryset las
cuentas rechazadas**, así que una cuenta rechazada no podía ni consultarse ni
recuperarse desde la API. Este endpoint las alcanza a propósito.
"""
import pytest
from rest_framework.test import APIClient

from verticals.cleaning.providers.models import ProviderAccount

URL = '/api/cleaning/providers/{pk}/request-verification/'


@pytest.fixture
def api_client():
    return APIClient()


def _set_status(account, status):
    account.verification_status = status
    account.save(update_fields=['verification_status'])
    return account


@pytest.mark.django_db(transaction=True)
def test_rejected_account_returns_to_pending(api_client, provider_account, cleaning_owner):
    _set_status(provider_account, ProviderAccount.Verification.REJECTED)
    api_client.force_authenticate(cleaning_owner)

    response = api_client.post(URL.format(pk=provider_account.pk))

    assert response.status_code == 200
    provider_account.refresh_from_db()
    assert provider_account.verification_status == ProviderAccount.Verification.PENDING
    assert provider_account.verified_at is None
    assert response.data['verification_status'] == 'pending'


@pytest.mark.django_db(transaction=True)
def test_pending_request_is_idempotent(api_client, provider_account, cleaning_owner):
    _set_status(provider_account, ProviderAccount.Verification.PENDING)
    api_client.force_authenticate(cleaning_owner)

    response = api_client.post(URL.format(pk=provider_account.pk))

    assert response.status_code == 200
    provider_account.refresh_from_db()
    assert provider_account.verification_status == ProviderAccount.Verification.PENDING


@pytest.mark.django_db(transaction=True)
def test_verified_request_does_not_downgrade(api_client, verified_provider_account, cleaning_owner):
    previo = verified_provider_account.verified_at
    api_client.force_authenticate(cleaning_owner)

    response = api_client.post(URL.format(pk=verified_provider_account.pk))

    assert response.status_code == 200
    verified_provider_account.refresh_from_db()
    assert verified_provider_account.verification_status == ProviderAccount.Verification.VERIFIED
    assert verified_provider_account.verified_at == previo


@pytest.mark.django_db(transaction=True)
def test_suspended_account_is_forbidden(api_client, provider_account, cleaning_owner):
    _set_status(provider_account, ProviderAccount.Verification.SUSPENDED)
    api_client.force_authenticate(cleaning_owner)

    response = api_client.post(URL.format(pk=provider_account.pk))

    assert response.status_code == 403
    assert response.data['code'] == 'provider_suspended'
    provider_account.refresh_from_db()
    assert provider_account.verification_status == ProviderAccount.Verification.SUSPENDED


@pytest.mark.django_db(transaction=True)
def test_inactive_account_is_forbidden(api_client, provider_account, cleaning_owner):
    provider_account.is_active = False
    provider_account.save(update_fields=['is_active'])
    api_client.force_authenticate(cleaning_owner)

    response = api_client.post(URL.format(pk=provider_account.pk))

    assert response.status_code == 403
    assert response.data['code'] == 'provider_inactive'


@pytest.mark.django_db(transaction=True)
def test_staff_member_cannot_request(api_client, provider_account, provider_staff):
    _set_status(provider_account, ProviderAccount.Verification.REJECTED)
    api_client.force_authenticate(provider_staff)

    response = api_client.post(URL.format(pk=provider_account.pk))

    assert response.status_code == 403
    assert response.data['code'] == 'forbidden_role'
    provider_account.refresh_from_db()
    assert provider_account.verification_status == ProviderAccount.Verification.REJECTED


@pytest.mark.django_db(transaction=True)
def test_anonymous_is_rejected(api_client, provider_account):
    response = api_client.post(URL.format(pk=provider_account.pk))
    assert response.status_code in (401, 403)
