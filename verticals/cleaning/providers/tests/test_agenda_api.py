"""API de agenda, recursos y miembros (§5.1, §6.1, §6.2).

Cubre las tres rutas que faltaban —`resources/`, `resources/{rid}/schedule/` y
`members/`— incluida la matriz de roles: `owner`/`admin` gestionan todo, el
`staff` solo su propia agenda, y la titularidad solo la cambia el titular
(ADR-11, con la invariante de §6.3 verificada después del traspaso).
"""

import pytest
from rest_framework.test import APIClient

from verticals.cleaning.availability.models import AvailabilityRule
from verticals.cleaning.providers.models import (
    ProviderMembership,
    ProviderResource,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


def resources_url(account):
    return f'/api/cleaning/providers/{account.pk}/resources/'


def schedule_url(account, resource):
    return f'/api/cleaning/providers/{account.pk}/resources/{resource.pk}/schedule/'


def members_url(account):
    return f'/api/cleaning/providers/{account.pk}/members/'


def regla(weekday=0, start='08:00', end='12:00', **extra):
    data = {'weekday': weekday, 'start_time': start, 'end_time': end}
    data.update(extra)
    return data


# ---------------------------------------------------------------------------
# Agenda de un recurso
# ---------------------------------------------------------------------------
def test_get_y_put_de_la_agenda(api_client, provider_account, cleaning_owner, cleaning_resource):
    api_client.force_authenticate(cleaning_owner)
    url = schedule_url(provider_account, cleaning_resource)

    vacia = api_client.get(url)
    assert vacia.status_code == 200
    assert vacia.json() == {
        'resource': cleaning_resource.pk,
        'resource_name': 'Principal',
        'rules': [],
        'exceptions': [],
    }

    respuesta = api_client.put(
        url,
        {
            'rules': [regla(0, '08:00', '12:00'), regla(0, '11:00', '15:00')],
            'exceptions': [{
                'kind': 'unavailable',
                'starts_at': '2026-12-25T00:00:00Z',
                'ends_at': '2026-12-26T00:00:00Z',
                'reason': 'Navidad',
            }],
        },
        format='json',
    )

    assert respuesta.status_code == 200
    assert len(respuesta.json()['rules']) == 2
    assert len(respuesta.json()['exceptions']) == 1
    assert AvailabilityRule.objects.filter(resource=cleaning_resource).count() == 2


def test_put_reemplaza_la_agenda_completa(api_client, provider_account, cleaning_owner, cleaning_resource):
    api_client.force_authenticate(cleaning_owner)
    url = schedule_url(provider_account, cleaning_resource)
    api_client.put(url, {'rules': [regla(0), regla(1)]}, format='json')

    respuesta = api_client.put(url, {'rules': [regla(2)]}, format='json')

    assert len(respuesta.json()['rules']) == 1
    assert respuesta.json()['exceptions'] == []
    assert AvailabilityRule.objects.filter(resource=cleaning_resource).count() == 1
    assert AvailabilityRule.objects.get(resource=cleaning_resource).weekday == 2


@pytest.mark.parametrize('cuerpo,campo', [
    ({'rules': [regla(0, '12:00', '08:00')]}, 'end_time'),
    ({'rules': [regla(0, valid_from='2026-12-01', valid_to='2026-11-01')]}, 'valid_to'),
    ({'rules': [regla(9)]}, 'weekday'),
    ({'rules': [{'weekday': 0, 'start_time': '08:00'}]}, 'end_time'),
])
def test_la_agenda_valida_sus_reglas(api_client, provider_account, cleaning_owner, cleaning_resource, cuerpo, campo):
    api_client.force_authenticate(cleaning_owner)

    respuesta = api_client.put(
        schedule_url(provider_account, cleaning_resource), cuerpo, format='json',
    )

    assert respuesta.status_code == 400
    assert respuesta.json()['code'] == 'validation_error'
    assert campo in str(respuesta.json()['extra'])


def test_el_staff_solo_gestiona_su_propia_agenda(
    api_client, provider_account, cleaning_staff, cleaning_resource, provider_staff,
):
    url = schedule_url(provider_account, cleaning_resource)
    api_client.force_authenticate(cleaning_staff)

    sin_asignar = api_client.put(url, {'rules': [regla(0)]}, format='json')
    cleaning_resource.members.add(cleaning_staff)
    asignado = api_client.put(url, {'rules': [regla(0)]}, format='json')

    assert sin_asignar.status_code == 403
    assert sin_asignar.json()['code'] == 'forbidden_role'
    assert asignado.status_code == 200


def test_la_agenda_no_es_accesible_para_terceros(api_client, provider_account, cleaning_resource, cleaning_customer):
    api_client.force_authenticate(cleaning_customer)

    respuesta = api_client.get(schedule_url(provider_account, cleaning_resource))

    assert respuesta.status_code == 403
    assert respuesta.json()['code'] == 'forbidden_role'


def test_la_agenda_exige_autenticacion(api_client, provider_account, cleaning_resource):
    respuesta = api_client.get(schedule_url(provider_account, cleaning_resource))

    assert respuesta.status_code == 401
    assert respuesta.json()['code'] == 'not_authenticated'


def test_un_recurso_de_otra_cuenta_devuelve_404(
    api_client, provider_account, cleaning_owner, cleaning_customer,
):
    from verticals.cleaning.providers.models import ProviderAccount

    ajena = ProviderAccount.objects.create(owner=cleaning_customer, display_name='Otra')
    ajeno = ajena.resources.get(name='Principal')
    api_client.force_authenticate(cleaning_owner)

    respuesta = api_client.get(schedule_url(provider_account, ajeno))

    assert respuesta.status_code == 404
    assert respuesta.json()['code'] == 'not_found'


# ---------------------------------------------------------------------------
# Recursos
# ---------------------------------------------------------------------------
def test_el_dueno_y_el_admin_anaden_recursos(
    api_client, provider_account, cleaning_owner, cleaning_admin, provider_admin,
):
    api_client.force_authenticate(cleaning_owner)
    del_dueno = api_client.post(
        resources_url(provider_account),
        {'name': 'Cuadrilla Sur', 'kind': 'crew', 'capacity': 2},
        format='json',
    )

    api_client.force_authenticate(cleaning_admin)
    del_admin = api_client.post(
        resources_url(provider_account),
        {'name': 'Cuadrilla Norte'},
        format='json',
    )

    assert del_dueno.status_code == 201
    assert del_dueno.json()['name'] == 'Cuadrilla Sur'
    assert del_admin.status_code == 201
    assert ProviderResource.objects.filter(account=provider_account).count() == 3


def test_el_staff_no_anade_recursos(api_client, provider_account, cleaning_staff, provider_staff):
    api_client.force_authenticate(cleaning_staff)

    respuesta = api_client.post(
        resources_url(provider_account), {'name': 'No autorizado'}, format='json',
    )

    assert respuesta.status_code == 403
    assert respuesta.json()['code'] == 'forbidden_role'


def test_no_se_repiten_nombres_de_recurso(api_client, provider_account, cleaning_owner, cleaning_resource):
    api_client.force_authenticate(cleaning_owner)

    respuesta = api_client.post(
        resources_url(provider_account), {'name': 'Principal'}, format='json',
    )

    assert respuesta.status_code == 400
    assert 'name' in respuesta.json()['extra']['fields']


def test_los_miembros_de_un_recurso_necesitan_membership_staff(
    api_client, provider_account, cleaning_owner, cleaning_staff, cleaning_customer,
):
    api_client.force_authenticate(cleaning_owner)

    sin_membership = api_client.post(
        resources_url(provider_account),
        {'name': 'Con cliente', 'members': [cleaning_customer.pk]},
        format='json',
    )
    assert sin_membership.status_code == 400

    ProviderMembership.objects.create(
        account=provider_account, user=cleaning_staff,
        role=ProviderMembership.Role.STAFF,
    )
    con_staff = api_client.post(
        resources_url(provider_account),
        {'name': 'Con staff', 'members': [cleaning_staff.pk]},
        format='json',
    )

    assert con_staff.status_code == 201
    assert con_staff.json()['members'] == [cleaning_staff.pk]


def test_el_staff_solo_lista_sus_recursos(
    api_client, provider_account, cleaning_staff, provider_staff, cleaning_resource,
):
    ProviderResource.objects.create(account=provider_account, name='Cuadrilla 2')
    api_client.force_authenticate(cleaning_staff)

    sin_asignar = api_client.get(resources_url(provider_account))
    cleaning_resource.members.add(cleaning_staff)
    asignado = api_client.get(resources_url(provider_account))

    assert sin_asignar.json()['count'] == 0
    assert asignado.json()['count'] == 1


# ---------------------------------------------------------------------------
# Miembros y titularidad
# ---------------------------------------------------------------------------
def test_dueno_y_admin_gestionan_miembros(
    api_client, provider_account, cleaning_owner, cleaning_admin, cleaning_staff,
    provider_admin,
):
    api_client.force_authenticate(cleaning_owner)
    creado = api_client.post(
        members_url(provider_account),
        {'user': cleaning_staff.pk, 'role': 'staff'},
        format='json',
    )

    api_client.force_authenticate(cleaning_admin)
    actualizado = api_client.post(
        members_url(provider_account),
        {'user': cleaning_staff.pk, 'role': 'admin'},
        format='json',
    )

    assert creado.status_code == 201
    assert creado.json()['role'] == 'staff'
    assert actualizado.status_code == 200
    assert actualizado.json()['role'] == 'admin'


def test_el_staff_no_gestiona_miembros(
    api_client, provider_account, cleaning_staff, provider_staff, cleaning_customer,
):
    api_client.force_authenticate(cleaning_staff)

    respuesta = api_client.post(
        members_url(provider_account),
        {'user': cleaning_customer.pk, 'role': 'staff'},
        format='json',
    )

    assert respuesta.status_code == 403
    assert respuesta.json()['code'] == 'forbidden_role'


def test_un_admin_no_puede_cambiar_la_titularidad(
    api_client, provider_account, cleaning_admin, provider_admin, cleaning_customer,
):
    api_client.force_authenticate(cleaning_admin)

    respuesta = api_client.post(
        members_url(provider_account),
        {'user': cleaning_customer.pk, 'role': 'owner'},
        format='json',
    )

    assert respuesta.status_code == 403
    assert respuesta.json()['code'] == 'forbidden_role'


def test_el_traspaso_de_titularidad_actualiza_cuenta_membership_y_seller(
    api_client, provider_account, cleaning_owner, cleaning_admin, provider_admin,
    cleaning_service,
):
    """ADR-11 + §6.3: cuenta, membership y `seller` de los servicios, en una transacción."""
    assert cleaning_service.seller_id == cleaning_owner.id
    api_client.force_authenticate(cleaning_owner)

    respuesta = api_client.post(
        members_url(provider_account),
        {'user': cleaning_admin.pk, 'role': 'owner'},
        format='json',
    )

    assert respuesta.status_code in (200, 201)
    provider_account.refresh_from_db()
    cleaning_service.refresh_from_db()
    assert provider_account.owner_id == cleaning_admin.id
    assert cleaning_service.seller_id == cleaning_admin.id
    assert ProviderMembership.objects.get(
        account=provider_account, user=cleaning_owner,
    ).is_active is False
    assert ProviderMembership.objects.get(
        account=provider_account, user=cleaning_admin,
    ).role == ProviderMembership.Role.OWNER

    # El nuevo titular manda y el anterior deja de poder editar el perfil.
    api_client.force_authenticate(cleaning_admin)
    nuevo = api_client.patch(
        f'/api/cleaning/providers/{provider_account.pk}/',
        {'description': 'Ahora manda el nuevo'}, format='json',
    )
    api_client.force_authenticate(cleaning_owner)
    antiguo = api_client.patch(
        f'/api/cleaning/providers/{provider_account.pk}/',
        {'description': 'El anterior ya no'}, format='json',
    )

    assert nuevo.status_code == 200
    assert antiguo.status_code == 403


def test_la_invariante_de_propiedad_se_mantiene(
    api_client, provider_account, cleaning_owner, cleaning_admin, provider_admin,
    cleaning_service,
):
    """§6.3: `listing.seller_id == account.owner_id` para todo servicio."""
    api_client.force_authenticate(cleaning_owner)
    api_client.post(
        members_url(provider_account),
        {'user': cleaning_admin.pk, 'role': 'owner'},
        format='json',
    )

    cleaning_service.refresh_from_db()
    assert (
        cleaning_service.seller_id
        == cleaning_service.service_details.provider_account.owner_id
    )


def test_baja_de_miembro_y_proteccion_de_la_titularidad(
    api_client, provider_account, cleaning_owner, cleaning_staff, provider_staff,
):
    api_client.force_authenticate(cleaning_owner)

    sin_usuario = api_client.delete(members_url(provider_account))
    baja = api_client.delete(f'{members_url(provider_account)}?user={cleaning_staff.pk}')
    titular = api_client.delete(f'{members_url(provider_account)}?user={cleaning_owner.pk}')
    inexistente = api_client.delete(f'{members_url(provider_account)}?user=99999999')

    assert sin_usuario.status_code == 400
    assert sin_usuario.json()['code'] == 'validation_error'
    assert baja.status_code == 204
    assert ProviderMembership.objects.get(
        account=provider_account, user=cleaning_staff,
    ).is_active is False
    assert titular.status_code == 403
    assert titular.json()['code'] == 'forbidden_role'
    assert inexistente.status_code == 404
    assert inexistente.json()['code'] == 'not_found'


def test_la_baja_admite_el_usuario_en_el_cuerpo(
    api_client, provider_account, cleaning_owner, cleaning_staff, provider_staff,
):
    api_client.force_authenticate(cleaning_owner)

    respuesta = api_client.delete(
        members_url(provider_account),
        {'user': cleaning_staff.pk},
        format='json',
    )

    assert respuesta.status_code == 204
