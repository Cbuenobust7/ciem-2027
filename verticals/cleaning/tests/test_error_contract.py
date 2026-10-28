"""Contrato de error uniforme de la vertical (§5.2, §5.3).

Fija dos cosas:

1. Los errores de `/api/cleaning/` llevan `{code, detail, extra}` y un `detail`
   legible, sin el prefijo redundante `"detail: …"` que arrastraba DRF.
2. El marketplace base **no** cambia de formato: el `EXCEPTION_HANDLER` está
   acotado a las rutas de la vertical.
"""

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


def test_el_401_de_la_vertical_tiene_contrato_uniforme_y_detail_limpio(api_client):
    response = api_client.get('/api/cleaning/bookings/')

    assert response.status_code == 401
    data = response.json()
    assert set(data) == {'code', 'detail', 'extra'}
    assert data['code'] == 'not_authenticated'
    assert not data['detail'].startswith('detail:')
    assert 'credenciales' in data['detail'].lower()


def test_el_404_de_la_vertical_no_duplica_el_campo(api_client, cleaning_customer):
    api_client.force_authenticate(cleaning_customer)

    data = api_client.get('/api/cleaning/bookings/CL-2026-000999/').json()

    assert set(data) == {'code', 'detail', 'extra'}
    assert data['code'] == 'not_found'
    assert not data['detail'].startswith('detail:')


def test_el_error_de_validacion_estructura_los_campos(api_client, cleaning_customer):
    api_client.force_authenticate(cleaning_customer)

    response = api_client.post('/api/cleaning/bookings/', {}, format='json')

    assert response.status_code == 400
    data = response.json()
    assert data['code'] == 'validation_error'
    assert 'fields' in data['extra']
    assert set(data) == {'code', 'detail', 'extra'}


def test_el_nucleo_conserva_su_formato(api_client):
    """El handler solo reescribe `/api/cleaning/`; el resto del marketplace no cambia."""
    respuesta = api_client.post('/api/listings/', {}, format='json')

    assert respuesta.status_code == 401
    assert 'code' not in respuesta.json()
