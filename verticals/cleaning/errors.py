"""Errores de dominio de la vertical y contrato de error uniforme (§5.2, §5.3).

Todo endpoint bajo `/api/cleaning/` responde los errores con la misma forma:

    {"code": "...", "detail": "...", "extra": {...}}

`CleaningAPIError` transporta el `code` estable, el estado HTTP y los datos
`extra`. `cleaning_exception_handler` es el `EXCEPTION_HANDLER` de DRF: traduce
esas excepciones —y las de DRF— a esa forma **solo** para las rutas de la
vertical, de modo que el marketplace base conserva intacto su contrato.
"""

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import exceptions as drf_exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

CLEANING_URL_PREFIX = '/api/cleaning/'


class CleaningAPIError(Exception):
    """Error de negocio con código estable, estado HTTP y datos extra."""

    code = 'cleaning_error'
    status = 400

    def __init__(self, detail, *, code=None, status=None, extra=None):
        super().__init__(detail)
        self.detail = detail
        if code is not None:
            self.code = code
        if status is not None:
            self.status = status
        self.extra = extra or {}

    def as_dict(self):
        return {'code': self.code, 'detail': self.detail, 'extra': self.extra}


# --- 400 ---------------------------------------------------------------------
class InvalidPayload(CleaningAPIError):
    """Campos inválidos, parámetros ausentes o formato de fecha incorrecto."""

    code = 'validation_error'
    status = 400


# --- 401 / 403 ---------------------------------------------------------------
class NotAuthenticated(CleaningAPIError):
    code = 'not_authenticated'
    status = 401


class ForbiddenRole(CleaningAPIError):
    """Autenticado, pero su rol no alcanza para esta acción (§6.1)."""

    code = 'forbidden_role'
    status = 403


class NotParticipant(CleaningAPIError):
    """Intenta ver o tocar una reserva de la que no es parte (§5.3)."""

    code = 'not_participant'
    status = 403


class ProviderNotOperational(CleaningAPIError):
    """La ficha no tiene operativa habilitada (§4: directorio/reclamada/suspendida)."""

    code = 'provider_not_operational'
    status = 403


class ProviderSuspended(CleaningAPIError):
    """La cuenta está suspendida temporalmente (§4)."""

    code = 'provider_suspended'
    status = 403


class ProviderInactive(CleaningAPIError):
    """La cuenta está desactivada técnicamente."""

    code = 'provider_inactive'
    status = 403


class ClaimNotAvailable(CleaningAPIError):
    """La ficha no admite una reclamación en su estado actual."""

    code = 'claim_not_available'
    status = 409


class ClaimAlreadyPending(CleaningAPIError):
    """Ya existe una reclamación pendiente para esa ficha."""

    code = 'claim_already_pending'
    status = 409


class ProviderNotBookable(CleaningAPIError):
    """La ficha no puede recibir reservas (§4, §5)."""

    code = 'provider_not_bookable'
    status = 409


# --- 404 ---------------------------------------------------------------------
class ResourceNotFound(CleaningAPIError):
    code = 'not_found'
    status = 404


# --- 409 ---------------------------------------------------------------------
class SlotUnavailable(CleaningAPIError):
    """La restricción de exclusión de PostgreSQL rechazó el solapamiento (ADR-04)."""

    code = 'slot_unavailable'
    status = 409


class HoldExpired(CleaningAPIError):
    code = 'hold_expired'
    status = 409


class IdempotencyKeyReused(CleaningAPIError):
    code = 'idempotency_key_reused'
    status = 409


class InvalidTransition(CleaningAPIError):
    code = 'invalid_transition'
    status = 409


# --- 422 ---------------------------------------------------------------------
class OutsideServiceArea(CleaningAPIError):
    code = 'outside_service_area'
    status = 422


class TooSoon(CleaningAPIError):
    code = 'too_soon'
    status = 422


class BeyondHorizon(CleaningAPIError):
    code = 'beyond_horizon'
    status = 422


class ProviderNotVerified(CleaningAPIError):
    code = 'provider_not_verified'
    status = 422


class AlreadyReviewed(CleaningAPIError):
    code = 'already_reviewed'
    status = 422


class ServiceInactive(CleaningAPIError):
    code = 'service_inactive'
    status = 422


class ResourceUnavailable(CleaningAPIError):
    code = 'resource_unavailable'
    status = 422


# Mapa de excepciones de DRF a códigos estables de la vertical (§5.3). Django
# entrega `Http404`/`PermissionDenied` sin envolver cuando el código usa
# `get_object_or_404`, así que también se mapean aquí.
_DRF_CODES = (
    (drf_exceptions.ValidationError, 'validation_error'),
    (drf_exceptions.NotAuthenticated, 'not_authenticated'),
    (drf_exceptions.AuthenticationFailed, 'not_authenticated'),
    (drf_exceptions.PermissionDenied, 'forbidden_role'),
    (DjangoPermissionDenied, 'forbidden_role'),
    (drf_exceptions.NotFound, 'not_found'),
    (Http404, 'not_found'),
    (drf_exceptions.MethodNotAllowed, 'method_not_allowed'),
    (drf_exceptions.NotAcceptable, 'not_acceptable'),
    (drf_exceptions.UnsupportedMediaType, 'unsupported_media_type'),
    (drf_exceptions.Throttled, 'throttled'),
)


def _drf_code(exc):
    for klass, code in _DRF_CODES:
        if isinstance(exc, klass):
            return code
    return 'error'


def _flatten(data):
    """Convierte el detalle de DRF en (texto legible, extra estructurado).

    Cuando DRF devuelve una sola clave genérica (`detail` de un 401/403/404, o
    `non_field_errors`), su texto ya es la frase completa: anteponerle el nombre
    del campo producía mensajes como "detail: Las credenciales…".
    """
    if isinstance(data, dict):
        if len(data) == 1:
            campo, valor = next(iter(data.items()))
            if campo in ('detail', 'non_field_errors'):
                if isinstance(valor, (list, tuple)):
                    return ' '.join(str(v) for v in valor), {'fields': data}
                return str(valor), {'fields': data}
        mensajes = []
        for campo, valor in data.items():
            if isinstance(valor, (list, tuple)):
                mensajes.append(f'{campo}: ' + ' '.join(str(v) for v in valor))
            else:
                mensajes.append(f'{campo}: {valor}')
        return ' '.join(mensajes) or 'Petición inválida.', {'fields': data}
    if isinstance(data, (list, tuple)):
        return ' '.join(str(v) for v in data), {'fields': list(data)}
    return str(data), {}


def cleaning_exception_handler(exc, context):
    """`EXCEPTION_HANDLER` de DRF, acotado a las rutas de la vertical."""
    if isinstance(exc, CleaningAPIError):
        return Response(exc.as_dict(), status=exc.status)

    request = context.get('request') if context else None
    path = getattr(request, 'path', '') or ''
    if not path.startswith(CLEANING_URL_PREFIX):
        # El núcleo conserva su contrato original.
        return drf_exception_handler(exc, context)

    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    detail, extra = _flatten(response.data)
    response.data = {
        'code': _drf_code(exc),
        'detail': detail,
        'extra': extra,
    }
    return response
