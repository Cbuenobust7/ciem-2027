"""Moderación de servicios publicados (núcleo `marketplace.listings`).

La máquina de estados vive en el núcleo, pero se maneja desde el panel del
proveedor, así que aquí se ejerce con los roles de la vertical: el `owner`/`admin`
envía a revisión, la plataforma (`is_staff`) aprueba o rechaza, y el catálogo
público solo muestra lo aprobado.

Reglas que estas pruebas fijan:

- `draft` y `rejected` pueden enviarse a revisión; `active` **no** (409).
- Enviar a revisión limpia el motivo y la revisión anterior.
- Aprobar y rechazar registran revisor y fecha; rechazar exige motivo.
- Un servicio **no** se publica sin aprobación; un anuncio normal (sin
  `ServiceDetails`) sigue publicándose directo: el marketplace base no se rompe.
- El directorio público oculta `pending_review` y `rejected`; el privado los muestra.
- Editar un servicio `active` o `rejected` lo devuelve a `draft`.
- La aprobación masiva del admin solo toca servicios en `pending_review`.
"""

from decimal import Decimal

import pytest
from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory
from rest_framework.test import APIClient

from marketplace.listings.admin import ListingAdmin
from marketplace.listings.models import Listing
from verticals.cleaning.providers.models import ProviderAccount
from verticals.cleaning.services.models import ServiceDetails

pytestmark = pytest.mark.django_db

LISTINGS = '/api/listings/'


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def platform(db):
    """Usuario de plataforma: `is_staff` sin membership."""
    from django.contrib.auth import get_user_model

    return get_user_model().objects.create_user(
        username='plataforma', email='plataforma@test.local',
        password='pass-test-123', is_staff=True,
    )


def make_listing(account, *, status='draft', title='Servicio de prueba', con_detalles=True):
    listing = Listing.objects.create(
        seller=account.owner,
        title=title,
        description='Servicio de prueba',
        price=Decimal('100.00'),
        currency='PEN',
        status=status,
    )
    if con_detalles:
        ServiceDetails.objects.create(
            listing=listing,
            provider_account=account,
            duration_minutes=60,
            buffer_minutes=0,
        )
    return listing


def _request(user):
    """Petición mínima para llamar a `save_model`/acciones del admin sin HTTP."""
    request = RequestFactory().post('/admin/marketplace/listings/listing/')
    request.user = user
    return request


# ===========================================================================
# Máquina de estados (modelo)
# ===========================================================================
def test_enviar_a_revision_desde_borrador(provider_account):
    listing = make_listing(provider_account)

    listing.submit_for_review()

    listing.refresh_from_db()
    assert listing.status == 'pending_review'
    assert listing.rejection_reason == ''
    assert listing.reviewed_at is None
    assert listing.reviewed_by is None


def test_enviar_a_revision_desde_rechazado_limpia_el_motivo(provider_account, platform):
    listing = make_listing(provider_account, status='rejected')
    listing.reject(platform, 'Falta el RUC')

    listing.submit_for_review()

    listing.refresh_from_db()
    assert listing.status == 'pending_review'
    assert listing.rejection_reason == ''
    assert listing.reviewed_by is None


@pytest.mark.parametrize('status', ['active', 'pending_review', 'sold', 'expired'])
def test_solo_borrador_y_rechazado_van_a_revision(provider_account, status):
    listing = make_listing(provider_account, status=status)

    with pytest.raises(ValueError):
        listing.submit_for_review()

    listing.refresh_from_db()
    assert listing.status == status


def test_aprobar_registra_revisor_fecha_y_publicacion(provider_account, platform):
    listing = make_listing(provider_account, status='pending_review')

    listing.approve(platform)

    listing.refresh_from_db()
    assert listing.status == 'active'
    assert listing.reviewed_by_id == platform.id
    assert listing.reviewed_at is not None
    assert listing.published_at is not None


def test_rechazar_guarda_motivo_revisor_y_fecha(provider_account, platform):
    listing = make_listing(provider_account, status='pending_review')

    listing.reject(platform, 'Las fotos no son del servicio')

    listing.refresh_from_db()
    assert listing.status == 'rejected'
    assert listing.rejection_reason == 'Las fotos no son del servicio'
    assert listing.reviewed_by_id == platform.id
    assert listing.reviewed_at is not None
    assert listing.published_at is None


# ===========================================================================
# API: enviar a revisión
# ===========================================================================
def test_el_proveedor_envia_su_servicio_a_revision(api_client, provider_account, cleaning_owner):
    listing = make_listing(provider_account)
    api_client.force_authenticate(cleaning_owner)

    response = api_client.post(f'{LISTINGS}{listing.pk}/submit-review/')

    assert response.status_code == 200
    listing.refresh_from_db()
    assert listing.status == 'pending_review'


def test_un_anuncio_que_no_es_servicio_no_se_modera(api_client, provider_account, cleaning_owner):
    listing = make_listing(provider_account, con_detalles=False)
    api_client.force_authenticate(cleaning_owner)

    response = api_client.post(f'{LISTINGS}{listing.pk}/submit-review/')

    assert response.status_code == 400
    listing.refresh_from_db()
    assert listing.status == 'draft'


def test_enviar_dos_veces_devuelve_409(api_client, provider_account, cleaning_owner):
    listing = make_listing(provider_account)
    api_client.force_authenticate(cleaning_owner)
    assert api_client.post(f'{LISTINGS}{listing.pk}/submit-review/').status_code == 200

    segunda = api_client.post(f'{LISTINGS}{listing.pk}/submit-review/')

    assert segunda.status_code == 409


def test_un_tercero_no_envia_a_revision_el_servicio_ajeno(
    api_client, cleaning_service, cleaning_customer,
):
    """`cleaning_service` está activo, así que un tercero puede verlo pero no tocarlo."""
    api_client.force_authenticate(cleaning_customer)

    response = api_client.post(f'{LISTINGS}{cleaning_service.pk}/submit-review/')

    assert response.status_code == 403


# ===========================================================================
# API: publicar
# ===========================================================================
def test_publicar_un_servicio_exige_aprobacion(api_client, provider_account, cleaning_owner):
    listing = make_listing(provider_account)
    api_client.force_authenticate(cleaning_owner)

    response = api_client.post(f'{LISTINGS}{listing.pk}/publish/')

    assert response.status_code == 403
    assert 'revisión' in response.json()['detail'].lower()
    listing.refresh_from_db()
    assert listing.status == 'draft'


def test_la_plataforma_aprueba_publicando(api_client, provider_account, platform):
    listing = make_listing(provider_account, status='pending_review')
    api_client.force_authenticate(platform)

    response = api_client.post(f'{LISTINGS}{listing.pk}/publish/')

    assert response.status_code == 200
    listing.refresh_from_db()
    assert listing.status == 'active'
    assert listing.reviewed_by_id == platform.id


def test_un_anuncio_normal_sigue_publicandose_directo(api_client, provider_account, cleaning_owner):
    """El marketplace base (productos) no depende de la moderación de la vertical."""
    listing = make_listing(provider_account, con_detalles=False)
    api_client.force_authenticate(cleaning_owner)

    response = api_client.post(f'{LISTINGS}{listing.pk}/publish/')

    assert response.status_code == 200
    listing.refresh_from_db()
    assert listing.status == 'active'


# ===========================================================================
# Visibilidad y edición desde el panel
# ===========================================================================
def test_lo_publico_oculta_pendientes_y_rechazados(
    api_client, provider_account, cleaning_owner, cleaning_service, platform,
):
    pendiente = make_listing(provider_account, status='pending_review', title='Pendiente')
    rechazado = make_listing(provider_account, status='rejected', title='Rechazado')
    rechazado.reject(platform, 'No cumple')

    publico = api_client.get(f'/api/cleaning/providers/{provider_account.pk}/services/')
    api_client.force_authenticate(cleaning_owner)
    privado = api_client.get(
        f'/api/cleaning/providers/{provider_account.pk}/services/manage/',
    )

    assert publico.status_code == 200
    assert [item['listing_id'] for item in publico.json()['results']] == [cleaning_service.pk]
    visibles = {item['listing_id'] for item in privado.json()['results']}
    assert visibles == {cleaning_service.pk, pendiente.pk, rechazado.pk}


@pytest.mark.parametrize('status_inicial', ['active', 'rejected'])
def test_editar_un_servicio_activo_o_rechazado_lo_devuelve_a_borrador(
    api_client, provider_account, cleaning_owner, cleaning_service, status_inicial,
):
    listing = cleaning_service
    if status_inicial != 'active':
        listing.status = status_inicial
        listing.rejection_reason = 'Motivo anterior'
        listing.save(update_fields=['status', 'rejection_reason'])
    api_client.force_authenticate(cleaning_owner)

    response = api_client.patch(
        f'/api/cleaning/services/{listing.pk}/',
        {'price': '150.00'},
        format='json',
    )

    assert response.status_code == 200
    listing.refresh_from_db()
    assert listing.status == 'draft'
    assert listing.rejection_reason == ''


# ===========================================================================
# Admin: aprobación masiva
# ===========================================================================
def test_la_aprobacion_masiva_solo_toca_servicios_pendientes(
    provider_account, cleaning_owner, platform,
):
    pendiente = make_listing(provider_account, status='pending_review', title='Pendiente')
    borrador = make_listing(provider_account, status='draft', title='Borrador')
    no_servicio = make_listing(
        provider_account, status='pending_review', title='Producto', con_detalles=False,
    )
    ya_activo = make_listing(provider_account, status='active', title='Ya activo')

    request = _request(platform)
    ListingAdmin(Listing, AdminSite()).approve_selected_services(
        request, Listing.objects.all(),
    )

    pendiente.refresh_from_db()
    borrador.refresh_from_db()
    no_servicio.refresh_from_db()
    ya_activo.refresh_from_db()

    assert pendiente.status == 'active'
    assert pendiente.reviewed_by_id == platform.id
    assert pendiente.reviewed_at is not None
    # Ni los borradores, ni lo que no es servicio, ni lo ya aprobado se tocan.
    assert borrador.status == 'draft'
    assert no_servicio.status == 'pending_review'
    assert ya_activo.status == 'active'
    assert ya_activo.reviewed_by is None


def test_el_admin_deja_el_estado_en_solo_lectura(provider_account):
    """El estado no se edita a mano: se cambia con las acciones (o `approve`/`reject`)."""
    admin = ListingAdmin(Listing, AdminSite())

    assert 'reviewed_at' in admin.readonly_fields
    assert 'reviewed_by' in admin.readonly_fields
    assert 'approve_selected_services' in admin.actions


@pytest.mark.parametrize('nuevo_estado', ['active', 'rejected'])
def test_el_admin_estampa_la_revision_al_cambiar_el_estado_a_mano(
    provider_account, platform, nuevo_estado,
):
    """`status` sí se puede editar en el formulario, pero deja auditoría."""
    listing = make_listing(provider_account, status='pending_review')

    listing.status = nuevo_estado
    ListingAdmin(Listing, AdminSite()).save_model(
        _request(platform), listing, form=None, change=True,
    )

    listing.refresh_from_db()
    assert listing.status == nuevo_estado
    assert listing.reviewed_by_id == platform.id
    assert listing.reviewed_at is not None
    if nuevo_estado == 'active':
        assert listing.published_at is not None


def test_el_admin_no_estampa_revision_si_el_estado_no_es_de_moderacion(
    provider_account, platform,
):
    listing = make_listing(provider_account, status='active')

    listing.status = 'paused'
    ListingAdmin(Listing, AdminSite()).save_model(
        _request(platform), listing, form=None, change=True,
    )

    listing.refresh_from_db()
    assert listing.status == 'paused'
    assert listing.reviewed_by is None
    assert listing.reviewed_at is None


def test_can_be_edited_by_solo_el_vendedor_o_la_plataforma(provider_account, cleaning_owner, cleaning_customer, platform):
    listing = make_listing(provider_account)

    assert listing.can_be_edited_by(cleaning_owner) is True
    assert listing.can_be_edited_by(platform) is True
    assert listing.can_be_edited_by(cleaning_customer) is False
    assert ProviderAccount.objects.filter(pk=provider_account.pk).exists()
