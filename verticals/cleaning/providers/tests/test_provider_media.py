"""Alta de proveedor con logo (§5.1, §3.1).

El `logo` es un `ImageField`, así que el alta por multipart tiene que funcionar
igual que por JSON. La vista ya declara `MultiPartParser`; esto lo fija para que
nadie lo quite sin darse cuenta.
"""

import os

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from verticals.cleaning.providers.models import ProviderAccount, ProviderMembership

pytestmark = pytest.mark.django_db

PROVIDERS = '/api/cleaning/providers/'

PNG_MINIMO = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
    b'\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01'
    b'\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def media_temporal(settings, tmp_path):
    """Los archivos de prueba no deben quedar en el `media/` del proyecto."""
    settings.MEDIA_ROOT = tmp_path
    return tmp_path


def test_el_alta_admite_logo_por_multipart(api_client, cleaning_customer, media_temporal):
    api_client.force_authenticate(cleaning_customer)
    logo = SimpleUploadedFile('logo.png', PNG_MINIMO, content_type='image/png')

    response = api_client.post(
        PROVIDERS,
        {
            'display_name': 'Brillo Total',
            'kind': 'company',
            'description': 'Empresa de limpieza',
            'logo': logo,
            'terms_accepted': 'True',
        },
        format='multipart',
    )

    assert response.status_code == 201
    assert response.json()['display_name'] == 'Brillo Total'

    account = ProviderAccount.objects.get(display_name='Brillo Total')
    assert account.logo, 'el logo debería haberse guardado'
    assert account.logo.name.endswith('.png')
    assert os.path.exists(account.logo.path), 'el archivo debe existir en MEDIA_ROOT'
    # Y el alta sigue creando la membership `owner` (ADR-11).
    assert ProviderMembership.objects.get(
        account=account, user=cleaning_customer,
    ).role == ProviderMembership.Role.OWNER


def test_el_alta_sin_logo_sigue_yendo_por_json(api_client, cleaning_customer):
    api_client.force_authenticate(cleaning_customer)

    response = api_client.post(
        PROVIDERS,
        {
            'display_name': 'Sin Logo SL',
            'kind': 'individual',
            'terms_accepted': 'True',
        },
        format='json',
    )

    assert response.status_code == 201
    assert ProviderAccount.objects.get(display_name='Sin Logo SL').logo in (None, '')


def test_el_logo_es_opcional_en_multipart(api_client, cleaning_customer, media_temporal):
    api_client.force_authenticate(cleaning_customer)

    response = api_client.post(
        PROVIDERS,
        {
            'display_name': 'Solo texto',
            'kind': 'company',
            'terms_accepted': 'True',
        },
        format='multipart',
    )

    assert response.status_code == 201
    assert ProviderAccount.objects.get(display_name='Solo texto').logo in (None, '')


def test_un_cliente_sin_sesion_no_da_de_alta_cuentas(api_client, media_temporal):
    response = api_client.post(
        PROVIDERS,
        {'display_name': 'Anónima', 'kind': 'company'},
        format='multipart',
    )

    assert response.status_code == 401
    assert ProviderAccount.objects.count() == 0
