"""Fixtures de los tests de reservas.

Viven aquí —y no en un `conftest.py` en la raíz del paquete— porque sus fixtures
importan modelos de la vertical. El `pytest.ini` de la raíz, en cambio, sí es
agnóstico y sirve para cualquier proyecto del paquete.
"""

import pytest
from django.utils import timezone

from marketplace.visibility.models import City
from verticals.cleaning.bookings.models import Booking
from verticals.cleaning.bookings.services import create_booking
from verticals.cleaning.providers.models import (
    ProviderAccount,
    ProviderMembership,
    ProviderResource,
    ProviderServiceArea,
)

from .helpers import SLOT_START, make_service, make_user


@pytest.fixture
def owner(db):
    return make_user('owner')


@pytest.fixture
def customer(db):
    return make_user('customer')


@pytest.fixture
def other_customer(db):
    return make_user('other-customer')


@pytest.fixture
def account(owner):
    """Cuenta verificada, con membership `owner` y cobertura en San Borja.

    La cobertura no es decorativa: `validate_booking_request` (§8.1) rechaza
    reservar en un distrito que la cuenta no cubre, así que sin ella ninguna
    reserva de estos tests pasaría.
    """
    account = ProviderAccount.objects.create(
        owner=owner,
        display_name='CleanHome Lima',
        verification_status=ProviderAccount.Verification.VERIFIED,
        is_published=True,
    )
    ProviderMembership.objects.create(
        account=account, user=owner, role=ProviderMembership.Role.OWNER,
    )
    city, _ = City.objects.get_or_create(
        slug='lima-test', defaults={'name': 'Lima Test'},
    )
    ProviderServiceArea.objects.create(
        account=account, city=city, district='san-borja', district_label='San Borja',
    )
    return account


@pytest.fixture
def resource(account):
    """El recurso "Principal" que crea la señal `post_save` de ProviderAccount."""
    return account.resources.get(name='Principal')


@pytest.fixture
def second_resource(account):
    return ProviderResource.objects.create(account=account, name='Cuadrilla 2')


@pytest.fixture
def service(account):
    return make_service(account)


@pytest.fixture
def booked_slot(customer, service):
    """Reserva confirmada 10:00–13:00 (Lima), con buffer de 30 min."""
    booking, _ = create_booking(
        customer=customer,
        listing=service.listing,
        start_at=SLOT_START,
        address='Av. Arequipa 1234, dpto 501',
        district='san-borja',
    )
    booking.status = Booking.Status.CONFIRMED
    booking.hold_expires_at = None
    booking.confirmed_at = timezone.now()
    booking.save(
        update_fields=['status', 'hold_expires_at', 'confirmed_at', 'updated_at'],
    )
    return booking
