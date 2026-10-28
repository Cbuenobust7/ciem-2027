"""Servicios de dominio de `cleaning_bookings`.

Especificación: docs/CLEANING_VERTICAL_TECHNICAL_PLAN.md §4.1 (máquina de
estados), §8.1 (transacción de creación) y §3.4 (importes y códigos).

Reglas que este módulo hace cumplir y que no son negociables:

- El estado **solo** cambia por estos métodos, que envuelven `transaction.atomic()`
  y escriben un `BookingEvent`. Ninguna vista escribe `booking.status` a mano.
- La doble reserva la impide PostgreSQL (ADR-04). Aquí no se comprueba antes de
  insertar: se deja que la `ExclusionConstraint` decida y se traduce el SQLSTATE
  `23P01` a `slot_unavailable`. Cualquier otro `IntegrityError` se propaga.
- Un `GET` no purga nada; la expiración de holds ocurre **dentro** de esta
  transacción, antes del `INSERT` (ADR-06).
"""

import hashlib
from datetime import timedelta, timezone as dt_timezone
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from verticals.cleaning.errors import (
    IdempotencyKeyReused,
    InvalidPayload,
    InvalidTransition,
    HoldExpired,
    OutsideServiceArea,
    ProviderNotVerified,
    ResourceUnavailable,
    ServiceInactive,
    SlotUnavailable,
    TooSoon,
    BeyondHorizon,
)
from verticals.cleaning.providers.models import ProviderAccount, ProviderServiceArea

from .models import Booking, BookingCodeSequence, BookingEvent

# SQLSTATE de PostgreSQL que sí sabemos interpretar.
EXCLUSION_VIOLATION = '23P01'
UNIQUE_VIOLATION = '23505'
IDEMPOTENCY_CONSTRAINT = 'unique_booking_idempotency_per_customer'


def _pgcode(exc):
    return getattr(getattr(exc, '__cause__', None), 'pgcode', None) or getattr(
        exc, 'pgcode', None,
    )


def occupancy_filter(now=None):
    """Reservas que ocupan agenda: las activas, con el hold vencido excluido.

    Es el mismo criterio que el cálculo de disponibilidad y que el índice
    parcial de la `ExclusionConstraint` (ADR-04/ADR-06).
    """
    now = now or timezone.now()
    return (
        Q(status__in=[Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS])
        | Q(status=Booking.Status.REQUESTED, hold_expires_at__gte=now)
    )


# ---------------------------------------------------------------------------
# Códigos, importes y expiración
# ---------------------------------------------------------------------------
def next_booking_code(*, year=None):
    """Código visible `CL-2026-000123` (§3.4).

    El incremento se hace sobre `BookingCodeSequence` con `select_for_update()`
    dentro de la transacción de la reserva. Ese bloqueo protege **solo** la
    generación del código, nunca la agenda.
    """
    year = year or timezone.localdate().year
    try:
        with transaction.atomic():
            sequence, _ = BookingCodeSequence.objects.get_or_create(year=year)
    except IntegrityError:
        # Otra transacción creó la fila del año a la vez.
        sequence = BookingCodeSequence.objects.get(year=year)

    with transaction.atomic():
        sequence = (
            BookingCodeSequence.objects.select_for_update().get(pk=sequence.pk)
        )
        value = sequence.next_value
        sequence.next_value = value + 1
        sequence.save(update_fields=['next_value'])
    return f'CL-{year}-{value:06d}'


def fee_percent_for(account):
    """Porcentaje de comisión: cuenta → vertical → plataforma (ADR-08).

    `PLATFORM_FEE_PERCENT` del paquete base es un `float` (10.00), así que se
    coerciona con `str()` antes de operar en `Decimal`: `Decimal * float` lanza
    `TypeError`.
    """
    percent = account.platform_fee_percent
    if percent is None:
        percent = settings.CLEANING_PLATFORM_FEE_PERCENT
    if percent is None:
        percent = settings.PLATFORM_FEE_PERCENT
    return Decimal(str(percent))


def snapshot_prices(*, listing, account, service_area=None):
    """Importes congelados al reservar; se calculan una sola vez (§3.4)."""
    zone_fee = service_area.extra_fee if service_area else Decimal('0')
    price = (listing.price or Decimal('0')) + zone_fee
    platform_fee = (
        price * fee_percent_for(account) / 100
    ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return {
        'price': price,
        'zone_fee': zone_fee,
        'currency': listing.currency,
        'platform_fee': platform_fee,
        # La suma debe ser exacta: la CheckConstraint `booking_amounts_sum_to_price`
        # lo verifica en la base de datos.
        'provider_amount': price - platform_fee,
    }


def expire_holds(*, account, now=None):
    """Marca como `expired` los holds vencidos de la cuenta (ADR-06).

    No borra filas: escribe un `BookingEvent` por transición y saca la reserva
    del índice parcial de exclusión. `hold_expires_at` pasa a NULL porque la
    CheckConstraint `booking_hold_matches_status` lo exige para todo estado
    distinto de `requested`.
    """
    now = now or timezone.now()
    expired = 0
    pending = (
        Booking.objects
        .filter(
            account=account,
            status=Booking.Status.REQUESTED,
            hold_expires_at__lt=now,
        )
        .select_for_update()
        .order_by('id')
    )
    for booking in pending:
        BookingEvent.objects.create(
            booking=booking,
            from_status=booking.status,
            to_status=Booking.Status.EXPIRED,
            actor=None,
            actor_role='system',
            reason='hold_expired',
        )
        booking.status = Booking.Status.EXPIRED
        booking.hold_expires_at = None
        booking.save(update_fields=['status', 'hold_expires_at', 'updated_at'])
        expired += 1
    return expired


def expire_all_holds(*, now=None):
    """Igual que `expire_holds` pero para todas las cuentas (comando de gestión)."""
    now = now or timezone.now()
    account_ids = (
        Booking.objects
        .filter(status=Booking.Status.REQUESTED, hold_expires_at__lt=now)
        .values_list('account_id', flat=True)
        .distinct()
    )
    total = 0
    for account in ProviderAccount.objects.filter(id__in=list(account_ids)):
        total += expire_holds(account=account, now=now)
    return total


# ---------------------------------------------------------------------------
# Validaciones de la petición (§8.1 paso 1)
# ---------------------------------------------------------------------------
def validate_booking_request(*, listing, service, city=None, district='', start_at=None, now=None):
    """Valida lo que no escribe y devuelve la zona cubierta que fija el recargo.

    Orden intencional: primero el estado del servicio y de la cuenta, después la
    cobertura, y al final los límites temporales. Así el cliente recibe el error
    más accionable (por ejemplo "no cubrimos tu distrito" antes que "falta
    antelación").
    """
    now = now or timezone.now()
    account = service.provider_account

    if not service.is_active or listing.status != 'active':
        raise ServiceInactive(
            'El servicio no está disponible para reservar en este momento.',
            extra={'listing': listing.id, 'listing_status': listing.status},
        )

    if not account.is_bookable:
        raise ProviderNotVerified(
            'La cuenta del proveedor todavía no está habilitada para recibir reservas.',
            extra={
                'account': account.id,
                'participation_status': account.participation_status,
                'verification_status': account.verification_status,
                'is_active': account.is_active,
                'is_published': account.is_published,
            },
        )

    district_key = (district or '').strip().lower()
    if not district_key:
        raise InvalidPayload(
            'El distrito es obligatorio para reservar.',
            extra={'param': 'district'},
        )
    areas = ProviderServiceArea.objects.filter(
        account=account, district=district_key, is_active=True,
    )
    if city is not None:
        areas = areas.filter(city=city)
    service_area = areas.select_related('city').order_by('id').first()
    if service_area is None:
        raise OutsideServiceArea(
            'El proveedor no cubre ese distrito.',
            extra={'district': district_key, 'account': account.id},
        )

    if start_at is None:
        raise InvalidPayload('La fecha de inicio es obligatoria.', extra={'param': 'start_at'})
    if not timezone.is_aware(start_at):
        raise InvalidPayload(
            'La fecha de inicio debe incluir zona horaria (por ejemplo 2026-10-10T15:00:00Z).',
            extra={'param': 'start_at'},
        )

    earliest = now + timedelta(hours=service.min_notice_hours)
    if start_at < earliest:
        raise TooSoon(
            f'Este servicio necesita {service.min_notice_hours} h de antelación.',
            extra={
                'min_notice_hours': service.min_notice_hours,
                'start_at': start_at.isoformat(),
                'earliest_start': earliest.isoformat(),
            },
        )

    horizon = now + timedelta(days=service.max_horizon_days)
    if start_at > horizon:
        raise BeyondHorizon(
            f'No se puede reservar con más de {service.max_horizon_days} días de antelación.',
            extra={
                'max_horizon_days': service.max_horizon_days,
                'start_at': start_at.isoformat(),
                'last_start': horizon.isoformat(),
            },
        )
    return service_area


def fingerprint_request(*, listing, start_at, address, district, resource=None, customer_notes=''):
    """Huella estable de la petición, para detectar la reutilización de la clave."""
    payload = '|'.join([
        str(listing.pk),
        start_at.astimezone(dt_timezone.utc).isoformat(),
        (address or '').strip(),
        (district or '').strip().lower(),
        str(resource.pk) if resource is not None else '',
        (customer_notes or '').strip(),
    ])
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def validate_explicit_resource(*, account, resource):
    """El recurso pedido debe ser de la cuenta y estar activo."""
    if resource.account_id != account.id:
        raise ResourceUnavailable(
            'El recurso indicado no pertenece a esta cuenta.',
            extra={'resource_id': resource.id, 'account_id': account.id},
        )
    if not resource.is_active:
        raise ResourceUnavailable(
            'El recurso indicado no está activo.',
            extra={'resource_id': resource.id},
        )
    return resource


def validate_resource_capacity(*, resource, service_capacity):
    """El recurso debe poder atender la capacidad que pide el servicio.

    Interpretación de §8.1 paso 4: `ServiceDetails.capacity` es cuánta gente
    hace falta y `ProviderResource.capacity` cuánta aporta el recurso.
    """
    if service_capacity > resource.capacity:
        raise ResourceUnavailable(
            'El recurso no tiene capacidad suficiente para este servicio.',
            extra={
                'resource_id': resource.id,
                'resource_capacity': resource.capacity,
                'service_capacity': service_capacity,
            },
        )
    return resource


def pick_first_free_resource(*, account, start_at, occupies_until, now=None):
    """Primer recurso activo sin solape en el rango (para no obligar a elegir).

    No toma ningún bloqueo: si dos peticiones eligen el mismo recurso a la vez,
    la `ExclusionConstraint` decide y la perdedora recibe 409 (§8.2).
    """
    resources = list(account.resources.filter(is_active=True).order_by('id'))
    if not resources:
        raise ResourceUnavailable(
            'La cuenta no tiene ningún recurso activo para asignar.',
            extra={'account_id': account.id},
        )
    busy = set(
        Booking.objects
        .filter(
            resource__in=resources,
            start_at__lt=occupies_until,
            occupies_until__gt=start_at,
        )
        .filter(occupancy_filter(now))
        .values_list('resource_id', flat=True)
    )
    for resource in resources:
        if resource.id not in busy:
            return resource
    raise SlotUnavailable(
        'No queda ningún recurso libre en ese horario.',
        extra={
            'account_id': account.id,
            'start_at': start_at.isoformat(),
            'occupies_until': occupies_until.isoformat(),
        },
    )


# ---------------------------------------------------------------------------
# Creación (§8.1)
# ---------------------------------------------------------------------------
def create_booking(
    *,
    customer,
    listing,
    start_at,
    address,
    district,
    city=None,
    resource=None,
    customer_notes='',
    idempotency_key=None,
    now=None,
):
    """Crea una reserva en `requested`. Devuelve `(booking, created)`.

    `created=False` significa que la clave de idempotencia ya había registrado
    exactamente esta petición y se devuelve la reserva existente (HTTP 200).
    """
    now = now or timezone.now()
    service = listing.service_details
    account = service.provider_account
    duration = timedelta(minutes=service.duration_minutes)
    buffer_minutes = service.buffer_minutes

    service_area = validate_booking_request(
        listing=listing,
        service=service,
        city=city,
        district=district,
        start_at=start_at,
        now=now,
    )
    fingerprint = fingerprint_request(
        listing=listing,
        start_at=start_at,
        address=address,
        district=district,
        resource=resource,
        customer_notes=customer_notes,
    )

    try:
        with transaction.atomic():
            # 2. Idempotencia: misma clave + misma petición ⇒ la reserva existente.
            if idempotency_key:
                existing = (
                    Booking.objects
                    .filter(customer=customer, idempotency_key=idempotency_key)
                    .first()
                )
                if existing is not None:
                    if existing.request_fingerprint != fingerprint:
                        raise IdempotencyKeyReused(
                            'Esa clave de idempotencia ya se usó con otra petición.',
                            extra={
                                'idempotency_key': idempotency_key,
                                'booking': existing.code,
                            },
                        )
                    return existing, False

            # 3. Los holds vencidos salen del índice parcial antes del INSERT.
            expire_holds(account=account, now=now)

            # 4. Recurso e importes congelados (ADR-08).
            if resource is not None:
                validate_explicit_resource(account=account, resource=resource)
            else:
                resource = pick_first_free_resource(
                    account=account,
                    start_at=start_at,
                    occupies_until=start_at + duration + timedelta(minutes=buffer_minutes),
                    now=now,
                )
            validate_resource_capacity(
                resource=resource, service_capacity=service.capacity,
            )
            amounts = snapshot_prices(
                listing=listing, account=account, service_area=service_area,
            )
            hold_expires_at = now + timedelta(
                minutes=settings.BOOKING_HOLD_TTL_MINUTES,
            )

            # 5. INSERT: aquí decide PostgreSQL (23P01 si solapa).
            booking = Booking.objects.create(
                code=next_booking_code(),
                customer=customer,
                account=account,
                resource=resource,
                listing=listing,
                service_title=listing.title,
                start_at=start_at,
                end_at=start_at + duration,
                buffer_minutes=buffer_minutes,
                occupies_until=start_at + duration + timedelta(minutes=buffer_minutes),
                status=Booking.Status.REQUESTED,
                hold_expires_at=hold_expires_at,
                address=address,
                district=(district or '').strip().lower(),
                city=city,
                customer_notes=customer_notes,
                idempotency_key=idempotency_key,
                request_fingerprint=fingerprint,
                **amounts,
            )

            # 6. Auditoría.
            BookingEvent.objects.create(
                booking=booking,
                from_status='',
                to_status=booking.status,
                actor=customer,
                actor_role='customer',
            )
            return booking, True
    except IntegrityError as exc:
        code = _pgcode(exc)
        if code == EXCLUSION_VIOLATION:
            raise SlotUnavailable(
                'Ese horario se acaba de ocupar; elige otro.',
                extra={
                    'resource_id': resource.id if resource else None,
                    'start_at': start_at.isoformat(),
                },
            ) from exc
        if code == UNIQUE_VIOLATION and idempotency_key and IDEMPOTENCY_CONSTRAINT in str(exc):
            # Dos peticiones con la misma clave compitieron: la ganadora ya está.
            winner = (
                Booking.objects
                .filter(customer=customer, idempotency_key=idempotency_key)
                .first()
            )
            if winner is not None and winner.request_fingerprint == fingerprint:
                return winner, False
            if winner is not None:
                raise IdempotencyKeyReused(
                    'Esa clave de idempotencia ya se usó con otra petición.',
                    extra={'idempotency_key': idempotency_key, 'booking': winner.code},
                ) from exc
        raise


# ---------------------------------------------------------------------------
# Transiciones (§4.1). Ninguna vista toca `status` directamente.
# ---------------------------------------------------------------------------
def _locked(booking):
    return Booking.objects.select_for_update().get(pk=booking.pk)


def _record(booking, *, from_status, to_status, actor, role, reason='', event_type='status'):
    return BookingEvent.objects.create(
        booking=booking,
        from_status=from_status,
        to_status=to_status,
        actor=actor,
        actor_role=role,
        reason=reason,
        event_type=event_type,
    )


def _require_status(booking, allowed):
    if booking.status not in allowed:
        raise InvalidTransition(
            f'No se puede pasar de "{booking.status}" con esta acción.',
            extra={'status': booking.status, 'allowed': list(allowed)},
        )


def normalize_start_at(value):
    """Normaliza `start_at`: acepta datetime o cadena ISO 8601 con zona."""
    if value is None or isinstance(value, str):
        parsed = parse_datetime(value) if value else None
        if parsed is None:
            raise InvalidPayload(
                'La fecha de inicio debe estar en formato ISO 8601.',
                extra={'param': 'start_at', 'value': value},
            )
        if not timezone.is_aware(parsed):
            raise InvalidPayload(
                'La fecha de inicio debe incluir zona horaria (por ejemplo 2026-10-10T15:00:00Z).',
                extra={'param': 'start_at'},
            )
        return parsed
    return value


def confirm_booking(*, booking, actor, role, now=None):
    """Transición 1: `requested → confirmed` (proveedor o sistema si `is_instant`)."""
    now = now or timezone.now()
    with transaction.atomic():
        booking = _locked(booking)
        _require_status(booking, (Booking.Status.REQUESTED,))
        if booking.hold_expires_at is not None and booking.hold_expires_at < now:
            raise HoldExpired(
                'El bloqueo temporal venció; el cliente debe reservar de nuevo.',
                extra={'booking': booking.code, 'hold_expires_at': booking.hold_expires_at.isoformat()},
            )
        previous = booking.status
        booking.status = Booking.Status.CONFIRMED
        booking.confirmed_at = now
        booking.hold_expires_at = None
        booking.save(update_fields=['status', 'confirmed_at', 'hold_expires_at', 'updated_at'])
        _record(booking, from_status=previous, to_status=booking.status, actor=actor, role=role)
    return booking


def decline_booking(*, booking, actor, role, detail='', now=None):
    """Transición 2: `requested → cancelled` por rechazo del proveedor."""
    now = now or timezone.now()
    return _cancel(
        booking=booking, actor=actor, role=role,
        reason='provider', detail=detail, now=now,
        allowed=(Booking.Status.REQUESTED,),
    )


def cancel_booking(*, booking, actor, role, reason, detail='', now=None):
    """Transiciones 2, 5 y 7: cancelación por cliente/proveedor o incidencia."""
    now = now or timezone.now()
    if reason == 'incident':
        allowed = (Booking.Status.IN_PROGRESS,)
    else:
        allowed = (Booking.Status.REQUESTED, Booking.Status.CONFIRMED)
    return _cancel(
        booking=booking, actor=actor, role=role,
        reason=reason, detail=detail, now=now, allowed=allowed,
    )


def _cancel(*, booking, actor, role, reason, detail, now, allowed):
    with transaction.atomic():
        booking = _locked(booking)
        _require_status(booking, allowed)
        previous = booking.status
        booking.status = Booking.Status.CANCELLED
        booking.cancelled_at = now
        booking.cancelled_by = actor
        booking.cancel_reason = reason
        booking.cancel_detail = detail or ''
        booking.hold_expires_at = None
        booking.save(update_fields=[
            'status', 'cancelled_at', 'cancelled_by', 'cancel_reason',
            'cancel_detail', 'hold_expires_at', 'updated_at',
        ])
        _record(
            booking, from_status=previous, to_status=booking.status,
            actor=actor, role=role, reason=reason,
        )
    return booking


def start_booking(*, booking, actor, role, now=None):
    """Transición 4: `confirmed → in_progress` (no antes de 60 min del inicio)."""
    now = now or timezone.now()
    with transaction.atomic():
        booking = _locked(booking)
        _require_status(booking, (Booking.Status.CONFIRMED,))
        earliest = booking.start_at - timedelta(minutes=60)
        if now < earliest:
            raise InvalidTransition(
                'Todavía no se puede iniciar: falta más de una hora para el inicio.',
                extra={
                    'start_at': booking.start_at.isoformat(),
                    'earliest_start': earliest.isoformat(),
                },
            )
        previous = booking.status
        booking.status = Booking.Status.IN_PROGRESS
        booking.started_at = now
        booking.save(update_fields=['status', 'started_at', 'updated_at'])
        _record(booking, from_status=previous, to_status=booking.status, actor=actor, role=role)
    return booking


def complete_booking(*, booking, actor, role, now=None):
    """Transición 6: `in_progress → completed` (habilita la reseña verificada)."""
    now = now or timezone.now()
    with transaction.atomic():
        booking = _locked(booking)
        _require_status(booking, (Booking.Status.IN_PROGRESS,))
        previous = booking.status
        booking.status = Booking.Status.COMPLETED
        booking.completed_at = now
        booking.save(update_fields=['status', 'completed_at', 'updated_at'])
        _record(booking, from_status=previous, to_status=booking.status, actor=actor, role=role)
    return booking


def mark_paid(*, booking, actor, role, now=None):
    """Cobro manual del MVP (ADR-08 D-3): solo sobre una reserva `completed`.

    No acepta importe: el total ya está congelado en la reserva.
    """
    now = now or timezone.now()
    with transaction.atomic():
        booking = _locked(booking)
        _require_status(booking, (Booking.Status.COMPLETED,))
        if booking.payment_status == Booking.PaymentStatus.PAID:
            raise InvalidTransition(
                'La reserva ya figura como pagada.',
                extra={'booking': booking.code, 'payment_status': booking.payment_status},
            )
        previous = booking.status
        booking.payment_status = Booking.PaymentStatus.PAID
        booking.save(update_fields=['payment_status', 'updated_at'])
        _record(
            booking, from_status=previous, to_status=booking.status,
            actor=actor, role=role, reason='manual',
            event_type=BookingEvent.EventType.PAYMENT,
        )
    return booking
