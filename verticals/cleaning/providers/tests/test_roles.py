"""Separación de roles: un cliente no publica, solo reacciona (§6.1, ADR-11).

El gate vive en el núcleo (`CanPublishListing`) pero se apoya en
`ProviderMembership`, y con la vertical apagada vuelve al comportamiento del
paquete base. Además, el rol viaja en el usuario para que el frontend pueda
enrutar sin adivinar.
"""

import pytest
from rest_framework.test import APIClient

from marketplace.listings.models import Listing
from verticals.cleaning.providers.models import ProviderMembership

pytestmark = pytest.mark.django_db

LISTINGS = '/api/listings/'
PROFILE = '/api/auth/profile/'
LOGIN = '/api/auth/login/'

PASSWORD = 'pass-test-123'


@pytest.fixture
def api_client():
    return APIClient()


def payload(**overrides):
    data = {
        'title': 'Limpieza de prueba',
        'description': 'Servicio de prueba',
        'price': '100.00',
        'currency': 'PEN',
        'status': 'active',
        'location': 'Lima',
    }
    data.update(overrides)
    return data


# ---------------------------------------------------------------------------
# Publicar: solo owner/admin de una cuenta (o plataforma)
# ---------------------------------------------------------------------------
def test_un_cliente_no_puede_publicar(api_client, cleaning_customer):
    api_client.force_authenticate(cleaning_customer)

    response = api_client.post(LISTINGS, payload(), format='json')

    assert response.status_code == 403
    assert Listing.objects.count() == 0


def test_el_dueno_de_una_cuenta_publica(api_client, cleaning_owner, provider_account):
    api_client.force_authenticate(cleaning_owner)

    response = api_client.post(LISTINGS, payload(), format='json')

    assert response.status_code == 201
    assert Listing.objects.get().seller_id == cleaning_owner.id


def test_el_admin_de_una_cuenta_publica(api_client, cleaning_admin, provider_admin):
    api_client.force_authenticate(cleaning_admin)

    response = api_client.post(LISTINGS, payload(), format='json')

    assert response.status_code == 201


def test_el_staff_no_publica(api_client, cleaning_staff, provider_staff):
    """§6.1: el personal ejecuta trabajos, no tiene acceso comercial."""
    api_client.force_authenticate(cleaning_staff)

    response = api_client.post(LISTINGS, payload(), format='json')

    assert response.status_code == 403
    assert Listing.objects.count() == 0


def test_la_plataforma_publica(api_client, cleaning_customer):
    cleaning_customer.is_staff = True
    cleaning_customer.save(update_fields=['is_staff'])
    api_client.force_authenticate(cleaning_customer)

    response = api_client.post(LISTINGS, payload(), format='json')

    assert response.status_code == 201


def test_sin_autenticar_no_publica(api_client):
    response = api_client.post(LISTINGS, payload(), format='json')

    assert response.status_code == 401


def test_la_lectura_del_catalogo_sigue_siendo_publica(api_client, cleaning_owner, provider_account):
    api_client.force_authenticate(cleaning_owner)
    creado = api_client.post(LISTINGS, payload(), format='json')
    assert creado.status_code == 201
    # `status` es de solo lectura y nace en `draft`: se publica con su acción.
    publicado = api_client.post(f"{LISTINGS}{creado.json()['id']}/publish/")
    assert publicado.status_code == 200
    api_client.force_authenticate(None)

    response = api_client.get(LISTINGS)

    assert response.status_code == 200
    assert response.json()['count'] == 1


def test_con_la_vertical_apagada_vuelve_el_comportamiento_base(
    api_client, cleaning_customer, settings,
):
    """ADR-10: el paquete base sin vertical no debe quedar cerrado."""
    settings.CLEANING_VERTICAL_ENABLED = False
    api_client.force_authenticate(cleaning_customer)

    response = api_client.post(LISTINGS, payload(), format='json')

    assert response.status_code == 201


# ---------------------------------------------------------------------------
# El rol viaja en el usuario: alimenta el enrutado del frontend
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    'fixtures,es_proveedor,puede_publicar',
    [
        (('cleaning_customer',), False, False),
        (('cleaning_owner', 'provider_account'), True, True),
        (('cleaning_admin', 'provider_admin'), True, True),
        (('cleaning_staff', 'provider_staff'), True, False),
    ],
)
def test_el_perfil_dice_el_rol(
    api_client, request, fixtures, es_proveedor, puede_publicar,
):
    user = request.getfixturevalue(fixtures[0])
    for extra in fixtures[1:]:
        request.getfixturevalue(extra)
    api_client.force_authenticate(user)

    data = api_client.get(PROFILE).json()

    assert data['is_provider'] is es_proveedor
    assert data['can_publish'] is puede_publicar
    if es_proveedor:
        assert data['provider_accounts'], 'debe listar sus cuentas'
        assert data['provider_accounts'][0]['role'] in {'owner', 'admin', 'staff'}
    else:
        assert data['provider_accounts'] == []


def test_el_login_ya_trae_el_rol_para_enrutar(
    api_client, cleaning_owner, provider_account, cleaning_customer,
):
    """Sin petición extra: el propio login dice a qué panel ir."""
    proveedor = api_client.post(
        LOGIN,
        {'email': cleaning_owner.email, 'password': PASSWORD},
        format='json',
    )
    cliente = api_client.post(
        LOGIN,
        {'email': cleaning_customer.email, 'password': PASSWORD},
        format='json',
    )

    assert proveedor.status_code == 200
    assert proveedor.json()['user']['is_provider'] is True
    assert proveedor.json()['user']['can_publish'] is True
    assert cliente.status_code == 200
    assert cliente.json()['user']['is_provider'] is False


def test_la_membership_inactiva_no_da_rol(api_client, cleaning_owner, provider_account):
    ProviderMembership.objects.filter(
        account=provider_account, user=cleaning_owner,
    ).update(is_active=False)
    api_client.force_authenticate(cleaning_owner)

    data = api_client.get(PROFILE).json()

    assert data['is_provider'] is False
    assert data['can_publish'] is False


def test_una_cuenta_inactiva_no_da_rol(api_client, cleaning_owner, provider_account):
    provider_account.is_active = False
    provider_account.save(update_fields=['is_active'])
    api_client.force_authenticate(cleaning_owner)

    data = api_client.get(PROFILE).json()

    assert data['is_provider'] is False
    assert data['can_publish'] is False
