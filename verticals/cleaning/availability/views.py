"""Endpoint de disponibilidad (§5.1, §7.1).

Público (`AllowAny`): el cliente consulta huecos antes de autenticarse. Las
validaciones y sus respuestas son exactamente las de §7.1; los `reason` de los
días sin hueco son informativos y nunca producen un error HTTP.
"""

from datetime import date as date_type

from django.core.exceptions import ObjectDoesNotExist
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from marketplace.listings.models import Listing
from verticals.cleaning.errors import (
    BeyondHorizon,
    InvalidPayload,
    ResourceNotFound,
    ServiceInactive,
)
from verticals.cleaning.providers.models import ProviderAccount

from .serializers import serialize_availability
from .services import available_slots


class ProviderAvailabilityView(APIView):
    """`GET /api/cleaning/providers/{pk}/availability/?service=&from=&to=[&resource=]`."""

    permission_classes = [AllowAny]

    def get(self, request, pk):
        account = get_object_or_404(
            ProviderAccount.objects.filter(
                is_active=True,
                is_published=True,
                participation_status__in=ProviderAccount.OPERATING_PARTICIPATION,
            ).exclude(
                verification_status=ProviderAccount.Verification.REJECTED,
            ),
            pk=pk,
        )
        listing, service = _resolve_service(request, account)
        resource = _resolve_resource(request, account)
        date_from, date_to = _resolve_dates(request, service)
        days = available_slots(
            account=account,
            listing=listing,
            date_from=date_from,
            date_to=date_to,
            resource=resource,
        )
        return Response(serialize_availability(
            listing=listing,
            service=service,
            timezone_name=account.timezone,
            days=days,
            generated_at=timezone.now(),
        ))


def _resolve_service(request, account):
    """Localiza el `Listing` y su `ServiceDetails` validando §7.1."""
    raw = request.query_params.get('service')
    if not raw:
        raise InvalidPayload(
            'Falta el parámetro obligatorio "service".',
            extra={'param': 'service'},
        )
    if not str(raw).isdigit():
        raise InvalidPayload(
            'El parámetro "service" debe ser un identificador numérico.',
            extra={'param': 'service', 'value': raw},
        )

    listing = (
        Listing.objects.filter(pk=int(raw)).select_related('service_details').first()
    )
    if listing is None:
        raise ResourceNotFound('El servicio indicado no existe.', extra={'service': raw})
    try:
        service = listing.service_details
    except ObjectDoesNotExist:
        raise ResourceNotFound(
            'El listing indicado no es un servicio de la vertical de limpieza.',
            extra={'service': raw},
        )
    if service.provider_account_id != account.id:
        raise ResourceNotFound(
            'El servicio no pertenece a este proveedor.',
            extra={'service': raw, 'account': account.id},
        )
    # §7.1: `is_active=False` o `listing.status == 'paused'` → 422 service_inactive.
    if not service.is_active or listing.status == 'paused':
        raise ServiceInactive(
            'El servicio no está disponible para reservar en este momento.',
            extra={'service': listing.id, 'listing_status': listing.status},
        )
    return listing, service


def _resolve_resource(request, account):
    """`resource`, si viene, debe pertenecer a la cuenta y estar activo (§7.1)."""
    raw = request.query_params.get('resource')
    if not raw:
        return None
    if not str(raw).isdigit():
        raise InvalidPayload(
            'El parámetro "resource" debe ser un identificador numérico.',
            extra={'param': 'resource', 'value': raw},
        )
    resource = account.resources.filter(pk=int(raw), is_active=True).first()
    if resource is None:
        raise InvalidPayload(
            'El recurso indicado no pertenece a esta cuenta o no está activo.',
            extra={'param': 'resource', 'value': raw, 'account': account.id},
        )
    return resource


def _resolve_dates(request, service):
    """`from`/`to` en `YYYY-MM-DD`, `from <= to` y dentro del horizonte (§7.1)."""
    raw_from = request.query_params.get('from')
    raw_to = request.query_params.get('to')
    if not raw_from or not raw_to:
        raise InvalidPayload(
            'Faltan los parámetros "from" y "to" (YYYY-MM-DD).',
            extra={'params': ['from', 'to']},
        )
    try:
        date_from = date_type.fromisoformat(raw_from)
        date_to = date_type.fromisoformat(raw_to)
    except ValueError:
        raise InvalidPayload(
            'Formato de fecha inválido: se espera YYYY-MM-DD.',
            extra={'from': raw_from, 'to': raw_to},
        )
    if date_from > date_to:
        raise InvalidPayload(
            '"from" no puede ser posterior a "to".',
            extra={'from': raw_from, 'to': raw_to},
        )
    if (date_to - date_from).days > service.max_horizon_days:
        raise BeyondHorizon(
            f'El rango pedido supera el horizonte de {service.max_horizon_days} días.',
            extra={
                'max_horizon_days': service.max_horizon_days,
                'from': raw_from,
                'to': raw_to,
            },
        )
    return date_from, date_to
