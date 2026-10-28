"""Cruce disponibilidad ↔ creación (§10, criterio de aceptación).

> `GET availability` nunca ofrece un hueco que el `POST` rechace.

Es la prueba de la decisión 1 de §7.2: el cálculo usa el rango **ocupado**
(`start … start + duración + buffer`), el mismo que la `ExclusionConstraint`. Si
los dos criterios divergieran, la API ofrecería huecos que la base rechazaría con
409 y el usuario vería un error inexplicable. Diez combinaciones de duración y
buffer lo comprueban.
"""

from datetime import time, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from marketplace.visibility.models import City
from verticals.cleaning.availability.models import AvailabilityRule
from verticals.cleaning.providers.models import ProviderServiceArea
from verticals.cleaning.services.models import ServiceDetails

pytestmark = pytest.mark.django_db

COMBINACIONES = [
    (30, 0), (45, 15), (60, 0), (60, 30), (90, 0),
    (90, 15), (120, 30), (180, 0), (180, 30), (240, 60),
]


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def cobertura(provider_account):
    city, _ = City.objects.get_or_create(
        slug='lima-test', defaults={'name': 'Lima Test'},
    )
    return ProviderServiceArea.objects.create(
        account=provider_account, city=city,
        district='san-borja', district_label='San Borja',
    )


@pytest.mark.parametrize('duration,buffer', COMBINACIONES)
def test_ningun_slot_ofrecido_es_rechazado_por_el_post(
    api_client, verified_provider_account, cleaning_resource, cleaning_service,
    cleaning_customer, cobertura, duration, buffer,
):
    ServiceDetails.objects.filter(
        pk=cleaning_service.service_details.pk,
    ).update(duration_minutes=duration, buffer_minutes=buffer, min_notice_hours=0)
    dia = timezone.localdate() + timedelta(days=1)
    AvailabilityRule.objects.create(
        resource=cleaning_resource, weekday=dia.weekday(),
        start_time=time(8, 0), end_time=time(18, 0),
    )
    api_client.force_authenticate(cleaning_customer)

    disponibilidad = api_client.get(
        f'/api/cleaning/providers/{verified_provider_account.pk}/availability/'
        f'?service={cleaning_service.pk}&from={dia}&to={dia}',
    )
    assert disponibilidad.status_code == 200
    slots = disponibilidad.json()['days'][0]['slots']
    assert slots, (
        f'con duración {duration} y buffer {buffer} debería haber algún hueco'
    )

    respuesta = api_client.post(
        '/api/cleaning/bookings/',
        {
            'listing': cleaning_service.pk,
            'start_at': slots[0]['start'],
            'address': 'Av. Arequipa 1234, dpto 501',
            'district': 'san-borja',
        },
        format='json',
    )

    assert respuesta.status_code == 201, respuesta.json()
