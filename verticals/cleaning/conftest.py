"""Fixtures compartidas por los tests de la vertical.

Viven en la raíz del paquete para que cualquier app de `verticals/cleaning/` las
use. `provider_account` es el tenant de ADR-01; su recurso "Principal" lo crea la
señal `ensure_primary_resource` al guardar la cuenta (§3.1).
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from marketplace.categories.models import Category
from marketplace.listings.models import Listing
from marketplace.visibility.models import City
from verticals.cleaning.providers.models import (
    ProviderAccount,
    ProviderMembership,
)
from verticals.cleaning.services.models import ServiceDetails


@pytest.fixture
def cleaning_owner(db):
    return get_user_model().objects.create_user(
        username='cleaning-owner', email='cleaning-owner@test.local', password='pass-test-123',
    )


@pytest.fixture
def cleaning_admin(db):
    return get_user_model().objects.create_user(
        username='cleaning-admin', email='cleaning-admin@test.local', password='pass-test-123',
    )


@pytest.fixture
def cleaning_staff(db):
    return get_user_model().objects.create_user(
        username='cleaning-staff', email='cleaning-staff@test.local', password='pass-test-123',
    )


@pytest.fixture
def cleaning_customer(db):
    return get_user_model().objects.create_user(
        username='cleaning-customer', email='cleaning-customer@test.local', password='pass-test-123',
    )


@pytest.fixture
def provider_account(cleaning_owner):
    account = ProviderAccount.objects.create(
        owner=cleaning_owner,
        display_name='Proveedor de Prueba',
        is_published=True,
    )
    ProviderMembership.objects.create(
        account=account, user=cleaning_owner, role=ProviderMembership.Role.OWNER,
    )
    return account


@pytest.fixture
def verified_provider_account(provider_account):
    """Cuenta lista para recibir reservas (`is_bookable`, §3.1)."""
    provider_account.verification_status = ProviderAccount.Verification.VERIFIED
    provider_account.save(update_fields=['verification_status'])
    return provider_account


@pytest.fixture
def provider_admin(provider_account, cleaning_admin):
    ProviderMembership.objects.create(
        account=provider_account, user=cleaning_admin, role=ProviderMembership.Role.ADMIN,
    )
    return cleaning_admin


@pytest.fixture
def provider_staff(provider_account, cleaning_staff):
    ProviderMembership.objects.create(
        account=provider_account, user=cleaning_staff, role=ProviderMembership.Role.STAFF,
    )
    return cleaning_staff


@pytest.fixture
def cleaning_city(db):
    return City.objects.create(name='Lima Test', slug='lima-test')


@pytest.fixture
def cleaning_category(db):
    root = Category.objects.get(slug='limpieza')
    return root.children.get(slug='limpieza-profunda')


@pytest.fixture
def cleaning_resource(provider_account):
    """El recurso "Principal" que crea la señal en la zona de la cuenta."""
    return provider_account.resources.get(name='Principal')


@pytest.fixture
def cleaning_service(provider_account, cleaning_owner):
    """`Listing` + `ServiceDetails` de 180 min con 30 de buffer (10:00–13:00)."""
    listing = Listing.objects.create(
        seller=cleaning_owner,
        title='Limpieza profunda de departamento',
        description='Servicio de prueba',
        price=Decimal('120.00'),
        currency='PEN',
        status='active',
    )
    ServiceDetails.objects.create(
        listing=listing,
        provider_account=provider_account,
        duration_minutes=180,
        buffer_minutes=30,
    )
    return listing
