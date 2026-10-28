"""Aislamiento entre cuentas y matriz de permisos (§6.1, §6.4, §11.4).

Es el punto donde una vertical filtra datos de negocio entre empresas
competidoras y entre trabajadores de una misma empresa, así que lleva test
propio: la cuenta B no ve nada de la A, y el `staff` solo ve sus recursos.
"""

import pytest
from rest_framework.test import APIClient

from marketplace.visibility.models import City
from verticals.cleaning.bookings.models import Booking
from verticals.cleaning.bookings.services import create_booking
from verticals.cleaning.providers.models import (
    ProviderAccount,
    ProviderMembership,
    ProviderServiceArea,
)

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


@pytest.fixture
def rival(db):
    """Cuenta B con su dueño y su propio servicio: el competidor."""
    from decimal import Decimal

    from django.contrib.auth import get_user_model

    from marketplace.listings.models import Listing
    from verticals.cleaning.services.models import ServiceDetails

    User = get_user_model()
    owner_b = User.objects.create_user(
        username='owner-b', email='owner-b@test.local', password='test-pass-1234',
    )
    account_b = ProviderAccount.objects.create(
        owner=owner_b, display_name='Rival SAC',
        verification_status=ProviderAccount.Verification.VERIFIED,
    )
    ProviderMembership.objects.create(
        account=account_b, user=owner_b, role=ProviderMembership.Role.OWNER,
    )
    city, _ = City.objects.get_or_create(
        slug='lima-test', defaults={'name': 'Lima Test'},
    )
    ProviderServiceArea.objects.create(
        account=account_b, city=city, district='san-borja', district_label='San Borja',
    )
    listing = Listing.objects.create(
        seller=owner_b, title='Servicio del rival', description='x',
        price=Decimal('99.00'), currency='PEN', status='active',
    )
    ServiceDetails.objects.create(
        listing=listing, provider_account=account_b,
        duration_minutes=120, buffer_minutes=0,
    )
    return account_b, owner_b


def test_la_lista_no_mezcla_reservas_de_otra_cuenta(api_client, booking, owner, customer, rival):
    _, owner_b = rival

    api_client.force_authenticate(owner_b)
    ajeno = api_client.get(URL)
    api_client.force_authenticate(owner)
    propio = api_client.get(URL)
    api_client.force_authenticate(customer)
    cliente = api_client.get(URL)

    assert ajeno.json()['count'] == 0
    assert propio.json()['count'] == 1
    assert cliente.json()['count'] == 1


def test_el_detalle_de_otra_cuenta_devuelve_403_no_404(api_client, booking, rival):
    """§5.3 pide `not_participant`, no ocultar la existencia con un 404."""
    _, owner_b = rival
    api_client.force_authenticate(owner_b)

    response = api_client.get(f'{URL}{booking.code}/')

    assert response.status_code == 403
    assert response.json()['code'] == 'not_participant'


def test_la_plataforma_ve_todo(api_client, booking, cleaning_admin):
    cleaning_admin.is_staff = True
    cleaning_admin.save(update_fields=['is_staff'])
    api_client.force_authenticate(cleaning_admin)

    lista = api_client.get(URL)
    detalle = api_client.get(f'{URL}{booking.code}/')

    assert lista.json()['count'] == 1
    assert detalle.status_code == 200


def test_el_staff_sin_asignacion_no_ve_la_reserva(api_client, booking, account, cleaning_staff):
    ProviderMembership.objects.create(
        account=account, user=cleaning_staff, role=ProviderMembership.Role.STAFF,
    )
    api_client.force_authenticate(cleaning_staff)

    lista = api_client.get(URL)
    detalle = api_client.get(f'{URL}{booking.code}/')

    assert lista.json()['count'] == 0
    assert detalle.status_code == 403
    assert detalle.json()['code'] == 'not_participant'


def test_el_staff_asignado_al_recurso_si_la_ve(api_client, booking, account, cleaning_staff, resource):
    ProviderMembership.objects.create(
        account=account, user=cleaning_staff, role=ProviderMembership.Role.STAFF,
    )
    resource.members.add(cleaning_staff)
    api_client.force_authenticate(cleaning_staff)

    lista = api_client.get(URL)
    detalle = api_client.get(f'{URL}{booking.code}/')

    assert lista.json()['count'] == 1
    assert detalle.status_code == 200


def test_agenda_del_proveedor_respeta_los_recursos_asignados(
    api_client, booking, account, owner, cleaning_staff, resource,
):
    ProviderMembership.objects.create(
        account=account, user=cleaning_staff, role=ProviderMembership.Role.STAFF,
    )
    url = f'/api/cleaning/providers/{account.pk}/bookings/'

    api_client.force_authenticate(owner)
    del_dueno = api_client.get(url)
    api_client.force_authenticate(cleaning_staff)
    sin_asignar = api_client.get(url)
    resource.members.add(cleaning_staff)
    asignado = api_client.get(url)

    assert del_dueno.json()['count'] == 1
    assert sin_asignar.json()['count'] == 0
    assert asignado.json()['count'] == 1


def test_la_agenda_no_es_publica_para_un_tercero(api_client, account, rival):
    _, owner_b = rival
    api_client.force_authenticate(owner_b)

    response = api_client.get(f'/api/cleaning/providers/{account.pk}/bookings/')

    assert response.status_code == 403
    assert response.json()['code'] == 'forbidden_role'


@pytest.mark.parametrize(
    'rol,esperado',
    [('owner', 200), ('admin', 200), ('staff', 200), ('customer', 403), ('platform', 200)],
)
def test_matriz_de_quien_puede_confirmar(
    api_client, booking, account, owner, customer, cleaning_admin, cleaning_staff,
    rol, esperado,
):
    """§6.1: confirmar exige ser miembro de la cuenta (cualquier rol) o plataforma."""
    if rol == 'admin':
        ProviderMembership.objects.create(
            account=account, user=cleaning_admin, role=ProviderMembership.Role.ADMIN,
        )
        user = cleaning_admin
    elif rol == 'staff':
        ProviderMembership.objects.create(
            account=account, user=cleaning_staff, role=ProviderMembership.Role.STAFF,
        )
        user = cleaning_staff
    elif rol == 'customer':
        user = customer
    elif rol == 'platform':
        cleaning_admin.is_staff = True
        cleaning_admin.save(update_fields=['is_staff'])
        user = cleaning_admin
    else:
        user = owner
    api_client.force_authenticate(user)

    response = api_client.post(f'{URL}{booking.code}/confirm/', {}, format='json')

    assert response.status_code == esperado


@pytest.mark.parametrize(
    'rol,esperado',
    [('owner', 200), ('admin', 200), ('staff', 403), ('platform', 200)],
)
def test_matriz_de_quien_puede_cobrar(
    api_client, booking, account, owner, cleaning_admin, cleaning_staff, rol, esperado,
):
    """§6.1: el cobro manual es de `owner`/`admin` o plataforma, nunca de `staff`."""
    from django.utils import timezone

    booking.status = Booking.Status.COMPLETED
    booking.hold_expires_at = None
    booking.completed_at = timezone.now()
    booking.save(update_fields=['status', 'hold_expires_at', 'completed_at'])

    if rol == 'admin':
        ProviderMembership.objects.create(
            account=account, user=cleaning_admin, role=ProviderMembership.Role.ADMIN,
        )
        user = cleaning_admin
    elif rol == 'staff':
        ProviderMembership.objects.create(
            account=account, user=cleaning_staff, role=ProviderMembership.Role.STAFF,
        )
        user = cleaning_staff
    elif rol == 'platform':
        cleaning_admin.is_staff = True
        cleaning_admin.save(update_fields=['is_staff'])
        user = cleaning_admin
    else:
        user = owner
    api_client.force_authenticate(user)

    response = api_client.post(f'{URL}{booking.code}/mark-paid/', {}, format='json')

    assert response.status_code == esperado


def test_el_staff_no_edita_el_perfil_de_la_cuenta(api_client, account, cleaning_staff):
    """Decisión explícita de §6.1: el staff no tiene acceso comercial."""
    ProviderMembership.objects.create(
        account=account, user=cleaning_staff, role=ProviderMembership.Role.STAFF,
    )
    api_client.force_authenticate(cleaning_staff)

    response = api_client.patch(
        f'/api/cleaning/providers/{account.pk}/',
        {'description': 'Cambio no autorizado'},
        format='json',
    )

    assert response.status_code == 403


def test_el_staff_no_gestiona_las_zonas_de_la_cuenta(api_client, account, cleaning_staff):
    ProviderMembership.objects.create(
        account=account, user=cleaning_staff, role=ProviderMembership.Role.STAFF,
    )
    api_client.force_authenticate(cleaning_staff)

    response = api_client.get(f'/api/cleaning/providers/{account.pk}/service-areas/')

    assert response.status_code == 403
