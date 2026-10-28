"""Tests del cálculo de disponibilidad (§7.1, §7.2, §7.3).

Cubren la tabla completa de §7.3 más las validaciones del endpoint. El día de
referencia es el 2026-10-09 en `America/Lima` (UTC-5), así que la ventana local
08:00–12:00 son las 13:00–17:00 UTC.
"""

from datetime import date, datetime, time, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from verticals.cleaning.availability.models import (
    AvailabilityException,
    AvailabilityRule,
)
from verticals.cleaning.availability.services import available_slots
from verticals.cleaning.bookings.models import Booking
from verticals.cleaning.providers.models import ProviderResource
from verticals.cleaning.services.models import ServiceDetails

pytestmark = pytest.mark.django_db

UTC = dt_timezone.utc
LIMA = ZoneInfo('America/Lima')
DAY = date(2026, 10, 9)
WEEKDAY = DAY.weekday()
# "Ahora" muy anterior al rango, para que el aviso mínimo no interfiera.
BEFORE = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def lima(hour, minute=0, day=9):
    """Hora local de Lima del 9/10/2026, expresada en UTC."""
    return datetime.combine(date(2026, 10, day), time(hour, minute), tzinfo=LIMA).astimezone(UTC)


def make_rule(resource, start_hour, end_hour, *, weekday=None, **extra):
    return AvailabilityRule.objects.create(
        resource=resource,
        weekday=WEEKDAY if weekday is None else weekday,
        start_time=time(start_hour, 0),
        end_time=time(end_hour, 0),
        **extra,
    )


def make_booking(
    *,
    listing,
    resource,
    customer,
    start,
    end,
    status=Booking.Status.CONFIRMED,
    buffer_minutes=30,
    hold_expires_at=None,
    price=Decimal('120.00'),
):
    platform_fee = Decimal('12.00')
    return Booking.objects.create(
        code=f'CL-TEST-{uuid4().hex[:8].upper()}',
        customer=customer,
        account=listing.service_details.provider_account,
        resource=resource,
        listing=listing,
        service_title=listing.title,
        start_at=start,
        end_at=end,
        buffer_minutes=buffer_minutes,
        occupies_until=end + timedelta(minutes=buffer_minutes),
        status=status,
        hold_expires_at=hold_expires_at,
        address='Av. Arequipa 1234, dpto 501',
        district='san-borja',
        price=price,
        zone_fee=Decimal('0'),
        currency='PEN',
        platform_fee=platform_fee,
        provider_amount=price - platform_fee,
        deposit_amount=Decimal('0'),
    )


def slots_for(account, listing, *, date_from=DAY, date_to=DAY, resource=None, now=BEFORE):
    return available_slots(
        account=account,
        listing=listing,
        date_from=date_from,
        date_to=date_to,
        resource=resource,
        now=now,
    )


def local_hhmm(slots):
    return {slot.start.astimezone(LIMA).strftime('%H:%M') for slot in slots}


# ---------------------------------------------------------------------------
# §7.3 — tabla de casos de borde
# ---------------------------------------------------------------------------
def test_reglas_solapadas_no_duplican_slots(provider_account, cleaning_resource, cleaning_service):
    make_rule(cleaning_resource, 8, 12)
    make_rule(cleaning_resource, 11, 15)

    days = slots_for(provider_account, cleaning_service)

    assert days[0].reason is None
    assert local_hhmm(days[0].slots) == {
        '08:00', '08:30', '09:00', '11:00', '11:30', '12:00',
    }
    starts = [slot.start for slot in days[0].slots]
    assert len(starts) == len(set(starts))


def test_servicio_que_no_cabe_en_la_ventana(provider_account, cleaning_resource, cleaning_service):
    make_rule(cleaning_resource, 8, 10)  # 120 min < 180 de duración

    days = slots_for(provider_account, cleaning_service)

    assert days[0].slots == []
    assert days[0].reason == 'sin_espacio'


@pytest.mark.parametrize('status', [Booking.Status.CANCELLED, Booking.Status.COMPLETED])
def test_reserva_cancelada_o_completada_no_bloquea(
    provider_account, cleaning_resource, cleaning_service, cleaning_customer, status,
):
    make_rule(cleaning_resource, 8, 18)
    make_booking(
        listing=cleaning_service,
        resource=cleaning_resource,
        customer=cleaning_customer,
        start=lima(8),
        end=lima(11),
        status=status,
        hold_expires_at=None,
    )

    days = slots_for(provider_account, cleaning_service)

    assert '08:00' in local_hhmm(days[0].slots)


def test_hold_vigente_bloquea_y_el_buffer_del_predecesor_tambien(
    provider_account, cleaning_resource, cleaning_service, cleaning_customer,
):
    make_rule(cleaning_resource, 8, 18)
    # 08:00–11:00 + 30 de buffer ⇒ ocupa hasta las 11:30 locales.
    make_booking(
        listing=cleaning_service,
        resource=cleaning_resource,
        customer=cleaning_customer,
        start=lima(8),
        end=lima(11),
        status=Booking.Status.REQUESTED,
        hold_expires_at=BEFORE + timedelta(minutes=10),
    )

    days = slots_for(provider_account, cleaning_service)
    horas = local_hhmm(days[0].slots)

    assert '08:00' not in horas
    assert '11:00' not in horas   # 11:00 < 11:30 (rango ocupado, no duración)
    assert '11:30' in horas       # adyacente al final del buffer: sí cabe


def test_hold_vencido_no_bloquea_y_la_lectura_no_lo_purga(
    provider_account, cleaning_resource, cleaning_service, cleaning_customer,
):
    make_rule(cleaning_resource, 8, 18)
    vencido = make_booking(
        listing=cleaning_service,
        resource=cleaning_resource,
        customer=cleaning_customer,
        start=lima(8),
        end=lima(11),
        status=Booking.Status.REQUESTED,
        hold_expires_at=BEFORE - timedelta(minutes=1),
    )

    days = slots_for(provider_account, cleaning_service)

    assert '08:00' in local_hhmm(days[0].slots)
    # ADR-06: el GET ignora el hold vencido pero no lo modifica.
    vencido.refresh_from_db()
    assert vencido.status == Booking.Status.REQUESTED
    assert vencido.hold_expires_at is not None


def test_excepcion_no_disponible_de_tres_dias(
    provider_account, cleaning_resource, cleaning_service,
):
    for offset in range(3):
        make_rule(cleaning_resource, 8, 18, weekday=(WEEKDAY + offset) % 7)
    AvailabilityException.objects.create(
        resource=cleaning_resource,
        kind=AvailabilityException.Kind.UNAVAILABLE,
        starts_at=lima(0, day=9),
        ends_at=lima(0, day=12),
        reason='Vacaciones',
    )

    days = slots_for(
        provider_account, cleaning_service,
        date_from=DAY, date_to=DAY + timedelta(days=2),
    )

    assert len(days) == 3
    for day in days:
        assert day.slots == []
        assert day.reason == 'excepcion_no_disponible'


def test_excepcion_extra_genera_slots_en_un_dia_sin_regla(
    provider_account, cleaning_resource, cleaning_service,
):
    AvailabilityException.objects.create(
        resource=cleaning_resource,
        kind=AvailabilityException.Kind.EXTRA,
        starts_at=lima(9),
        ends_at=lima(12),
        reason='Refuerzo puntual',
    )

    days = slots_for(provider_account, cleaning_service)

    # Ventana 09:00–12:00 con duración de 180 min: solo cabe el candidato 09:00
    # (09:30 + 180 = 12:30 > 12:00).
    assert days[0].reason is None
    assert local_hhmm(days[0].slots) == {'09:00'}


def test_la_zona_del_recurso_manda_sobre_la_de_la_cuenta(
    provider_account, cleaning_resource, cleaning_service,
):
    cleaning_resource.timezone = 'UTC'
    cleaning_resource.save(update_fields=['timezone'])
    make_rule(cleaning_resource, 8, 12)

    days = slots_for(provider_account, cleaning_service)

    # La regla eran las 08:00 del recurso (UTC), no las 08:00 de Lima.
    assert days[0].slots[0].start == datetime(2026, 10, 9, 8, 0, tzinfo=UTC)


def test_aviso_minimo_filtra_los_slots_demasiado_pronto(
    provider_account, cleaning_resource, cleaning_service,
):
    make_rule(cleaning_resource, 8, 18)
    ahora = datetime(2026, 10, 9, 4, 0, tzinfo=UTC)  # + 12 h ⇒ 16:00 UTC

    days = slots_for(provider_account, cleaning_service, now=ahora)

    horas = sorted(slot.start for slot in days[0].slots)
    assert horas[0] == datetime(2026, 10, 9, 16, 0, tzinfo=UTC)
    assert all(start >= datetime(2026, 10, 9, 16, 0, tzinfo=UTC) for start in horas)


def test_max_per_day_agota_el_dia(
    provider_account, cleaning_resource, cleaning_service, cleaning_customer,
):
    make_rule(cleaning_resource, 8, 18)
    ServiceDetails.objects.filter(pk=cleaning_service.service_details.pk).update(max_per_day=1)
    cleaning_service.refresh_from_db()
    make_booking(
        listing=cleaning_service,
        resource=cleaning_resource,
        customer=cleaning_customer,
        start=lima(8),
        end=lima(11),
        status=Booking.Status.CONFIRMED,
    )

    days = slots_for(provider_account, cleaning_service)

    assert days[0].slots == []
    assert days[0].reason == 'sin_espacio'


def test_la_respuesta_se_acota_a_cincuenta_slots(provider_account, cleaning_resource, cleaning_service):
    ProviderResource.objects.create(account=provider_account, name='Cuadrilla 2')
    ServiceDetails.objects.filter(pk=cleaning_service.service_details.pk).update(
        duration_minutes=1, buffer_minutes=0,
    )
    for resource in provider_account.resources.all():
        make_rule(resource, 0, 23)

    days = slots_for(provider_account, cleaning_service)

    assert len(days[0].slots) == 50
    ordenados = [(slot.start, slot.resource_id) for slot in days[0].slots]
    assert ordenados == sorted(ordenados)


def test_dia_sin_reglas_ni_excepciones(provider_account, cleaning_resource, cleaning_service):
    days = slots_for(provider_account, cleaning_service)

    assert days[0].slots == []
    assert days[0].reason == 'fuera_de_horario'


def test_valid_from_y_valid_to_acotan_la_regla(provider_account, cleaning_resource, cleaning_service):
    make_rule(cleaning_resource, 8, 12, valid_from=DAY + timedelta(days=1))

    days = slots_for(
        provider_account, cleaning_service, date_from=DAY, date_to=DAY + timedelta(days=7),
    )

    # La regla es semanal: el día de referencia queda fuera por `valid_from` y
    # los días intermedios no son su weekday; la siguiente ocurrencia sí aplica.
    assert days[0].slots == []
    assert days[0].reason == 'fuera_de_horario'
    assert days[7].slots != []


def test_la_agenda_busca_el_primer_recurso_libre(provider_account, cleaning_resource, cleaning_service, cleaning_customer):
    segunda = ProviderResource.objects.create(account=provider_account, name='Cuadrilla 2')
    make_rule(cleaning_resource, 8, 12)
    make_rule(segunda, 8, 12)
    make_booking(
        listing=cleaning_service,
        resource=cleaning_resource,
        customer=cleaning_customer,
        start=lima(8),
        end=lima(11),
        status=Booking.Status.CONFIRMED,
    )

    days = slots_for(provider_account, cleaning_service)

    assert {slot.resource_name for slot in days[0].slots} == {'Cuadrilla 2'}


# ---------------------------------------------------------------------------
# Endpoint §7.1 / §5.2
# ---------------------------------------------------------------------------
@pytest.fixture
def api_client():
    return APIClient()


def availability_url(account, **params):
    query = '&'.join(f'{k}={v}' for k, v in params.items())
    return f'/api/cleaning/providers/{account.pk}/availability/?{query}'


def rule_for(target_day, resource, start_hour=8, end_hour=18):
    return AvailabilityRule.objects.create(
        resource=resource,
        weekday=target_day.weekday(),
        start_time=time(start_hour, 0),
        end_time=time(end_hour, 0),
    )


@pytest.fixture
def tomorrow():
    return timezone.localdate() + timedelta(days=1)


def test_endpoint_publico_responde_el_contrato(
    api_client, provider_account, cleaning_resource, cleaning_service, tomorrow,
):
    rule_for(tomorrow, cleaning_resource)
    ServiceDetails.objects.filter(pk=cleaning_service.service_details.pk).update(min_notice_hours=0)

    response = api_client.get(availability_url(
        provider_account, service=cleaning_service.pk, **{'from': tomorrow.isoformat(), 'to': tomorrow.isoformat()},
    ))

    assert response.status_code == 200
    data = response.json()
    assert set(data) == {'service', 'duration_minutes', 'timezone', 'days', 'generated_at'}
    assert data['service'] == cleaning_service.pk
    assert data['duration_minutes'] == 180
    assert data['timezone'] == provider_account.timezone
    assert data['generated_at'].endswith('Z')

    assert len(data['days']) == 1
    day = data['days'][0]
    assert day['date'] == tomorrow.isoformat()
    assert day['weekday'] == tomorrow.weekday()
    assert day['slots'], 'el día debería tener huecos'
    slot = day['slots'][0]
    assert set(slot) == {'start', 'end', 'resource_id', 'resource_name'}
    assert slot['start'].endswith('Z') and slot['end'].endswith('Z')
    assert slot['resource_id'] == cleaning_resource.pk
    assert slot['resource_name'] == cleaning_resource.name


def test_endpoint_marca_los_dias_sin_hueco_con_reason(
    api_client, provider_account, cleaning_resource, cleaning_service, tomorrow,
):
    response = api_client.get(availability_url(
        provider_account, service=cleaning_service.pk, **{'from': tomorrow.isoformat(), 'to': tomorrow.isoformat()},
    ))

    assert response.status_code == 200
    day = response.json()['days'][0]
    assert day['slots'] == []
    assert day['reason'] == 'fuera_de_horario'


def test_endpoint_404_si_la_cuenta_no_existe(api_client, cleaning_service, tomorrow):
    class Fantasma:
        pk = 99999999

    response = api_client.get(availability_url(
        Fantasma(), service=cleaning_service.pk, **{'from': tomorrow.isoformat(), 'to': tomorrow.isoformat()},
    ))

    assert response.status_code == 404
    assert response.json()['code'] == 'not_found'


@pytest.mark.parametrize('cambio', [{'is_active': False}, {'verification_status': 'rejected'}])
def test_endpoint_404_si_la_cuenta_no_es_visible(
    api_client, provider_account, cleaning_service, tomorrow, cambio,
):
    for campo, valor in cambio.items():
        setattr(provider_account, campo, valor)
    provider_account.save()

    response = api_client.get(availability_url(
        provider_account, service=cleaning_service.pk, **{'from': tomorrow.isoformat(), 'to': tomorrow.isoformat()},
    ))

    assert response.status_code == 404
    assert response.json()['code'] == 'not_found'


@pytest.mark.parametrize('cambio', [{'is_active': False}, {'status': 'paused'}])
def test_endpoint_422_si_el_servicio_no_esta_activo(
    api_client, provider_account, cleaning_resource, cleaning_service, tomorrow, cambio,
):
    if 'is_active' in cambio:
        ServiceDetails.objects.filter(pk=cleaning_service.service_details.pk).update(**cambio)
    else:
        cleaning_service.status = cambio['status']
        cleaning_service.save(update_fields=['status'])

    response = api_client.get(availability_url(
        provider_account, service=cleaning_service.pk, **{'from': tomorrow.isoformat(), 'to': tomorrow.isoformat()},
    ))

    assert response.status_code == 422
    assert response.json()['code'] == 'service_inactive'


def test_endpoint_400_sin_parametros_obligatorios(api_client, provider_account, cleaning_service, tomorrow):
    sin_service = api_client.get(availability_url(
        provider_account, **{'from': tomorrow.isoformat(), 'to': tomorrow.isoformat()},
    ))
    assert sin_service.status_code == 400
    assert sin_service.json()['code'] == 'validation_error'

    sin_fechas = api_client.get(availability_url(provider_account, service=cleaning_service.pk))
    assert sin_fechas.status_code == 400
    assert sin_fechas.json()['code'] == 'validation_error'


def test_endpoint_400_fechas_invalidas_o_invertidas(api_client, provider_account, cleaning_service, tomorrow):
    mal_formato = api_client.get(availability_url(
        provider_account, service=cleaning_service.pk, **{'from': 'ayer', 'to': tomorrow.isoformat()},
    ))
    assert mal_formato.status_code == 400

    invertidas = api_client.get(availability_url(
        provider_account, service=cleaning_service.pk,
        **{'from': tomorrow.isoformat(), 'to': (tomorrow - timedelta(days=3)).isoformat()},
    ))
    assert invertidas.status_code == 400
    assert invertidas.json()['code'] == 'validation_error'


def test_endpoint_422_fuera_del_horizonte(api_client, provider_account, cleaning_service, tomorrow):
    response = api_client.get(availability_url(
        provider_account, service=cleaning_service.pk,
        **{'from': tomorrow.isoformat(), 'to': (tomorrow + timedelta(days=90)).isoformat()},
    ))

    assert response.status_code == 422
    assert response.json()['code'] == 'beyond_horizon'


def test_endpoint_400_si_el_recurso_no_es_de_la_cuenta(
    api_client, provider_account, cleaning_service, tomorrow, cleaning_owner,
):
    from verticals.cleaning.providers.models import ProviderAccount

    otra = ProviderAccount.objects.create(owner=cleaning_owner, display_name='Otra cuenta')
    ajeno = otra.resources.get(name='Principal')

    response = api_client.get(availability_url(
        provider_account, service=cleaning_service.pk, resource=ajeno.pk,
        **{'from': tomorrow.isoformat(), 'to': tomorrow.isoformat()},
    ))

    assert response.status_code == 400
    assert response.json()['code'] == 'validation_error'


def test_endpoint_404_si_el_servicio_es_de_otra_cuenta(
    api_client, provider_account, cleaning_owner, tomorrow,
):
    from datetime import date as _date

    from marketplace.listings.models import Listing
    from verticals.cleaning.providers.models import ProviderAccount

    otra = ProviderAccount.objects.create(owner=cleaning_owner, display_name='Otra cuenta')
    listing = Listing.objects.create(
        seller=cleaning_owner, title='Ajeno', description='x',
        price=Decimal('50.00'), currency='PEN', status='active',
    )
    ServiceDetails.objects.create(
        listing=listing, provider_account=otra, duration_minutes=60, buffer_minutes=0,
    )

    response = api_client.get(availability_url(
        provider_account, service=listing.pk,
        **{'from': tomorrow.isoformat(), 'to': tomorrow.isoformat()},
    ))

    assert response.status_code == 404
    assert response.json()['code'] == 'not_found'


def test_los_errores_de_la_vertical_tienen_forma_uniforme(api_client, provider_account, cleaning_service):
    response = api_client.get(availability_url(provider_account, service=cleaning_service.pk))

    assert response.status_code == 400
    assert set(response.json()) == {'code', 'detail', 'extra'}
