"""Cálculo de disponibilidad — cuándo se puede (§7, ADR-05, ADR-07).

Objetivo de rendimiento explícito: **cuatro consultas constantes** (recursos,
reglas, excepciones y reservas activas), sin importar cuántos días, recursos o
reglas haya. No hay N+1 por día: los slots se calculan al vuelo y nunca se
materializan en el MVP.

Las cuatro decisiones que no son obvias y que este módulo respeta a propósito
(§7.2 de la especificación):

1. El test de solapamiento usa el rango **ocupado** del candidato
   (`start … start + duración + buffer`), el mismo criterio que la
   `ExclusionConstraint`. Si divergieran, la API ofrecería huecos que la base
   rechazaría con 409.
2. Una lectura nunca purga: los holds vencidos se **ignoran** al calcular pero
   no se modifican (ADR-06). La purga real ocurre en la transacción de creación.
3. `max_per_day` cuenta reservas activas de ese servicio por recurso y **día
   local**, no UTC.
4. La respuesta se acota a 50 slots por día.
"""

from dataclasses import dataclass, field
from datetime import date as date_type
from datetime import datetime, time as time_type
from datetime import timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from verticals.cleaning.bookings.models import Booking

from .models import AvailabilityException, AvailabilityRule

MAX_SLOTS_PER_DAY = 50
UTC = dt_timezone.utc

# Estados que ocupan agenda (los mismos del índice parcial de ADR-04), con la
# salvedad del hold vencido, que no bloquea.
ACTIVE_STATUSES = (
    Booking.Status.CONFIRMED,
    Booking.Status.IN_PROGRESS,
)
HOLDING_STATUS = Booking.Status.REQUESTED


@dataclass(frozen=True)
class Slot:
    start: datetime
    end: datetime
    resource_id: int
    resource_name: str


@dataclass
class DayAvailability:
    """Slots de un día. `reason` es informativo para la UI, nunca un error HTTP."""

    day: date_type
    slots: list[Slot] = field(default_factory=list)
    reason: str | None = None

    @property
    def weekday(self):
        """0 = lunes, igual que `AvailabilityRule.weekday`."""
        return self.day.weekday()


# ---------------------------------------------------------------------------
# Utilidades de tiempo
# ---------------------------------------------------------------------------
def _zone(name):
    return ZoneInfo(name or 'UTC')


def _day_bounds_utc(day, tz):
    """Fronteras UTC del día local `day` en la zona `tz` (respeta DST)."""
    start = datetime.combine(day, time_type.min, tzinfo=tz)
    end = datetime.combine(day + timedelta(days=1), time_type.min, tzinfo=tz)
    return start.astimezone(UTC), end.astimezone(UTC)


def _date_range(date_from, date_to):
    current = date_from
    while current <= date_to:
        yield current
        current += timedelta(days=1)


def _covering_utc_range(date_from, date_to, resources, tz_by_resource):
    """Rango UTC que cubre todos los días y recursos pedidos (una sola consulta)."""
    starts, ends = [], []
    for resource in resources:
        tz = tz_by_resource[resource.id]
        start, _ = _day_bounds_utc(date_from, tz)
        _, end = _day_bounds_utc(date_to, tz)
        starts.append(start)
        ends.append(end)
    return min(starts), max(ends)


def _subtract(windows, blocks):
    """Resta intervalos `[inicio, fin)` de una lista de ventanas."""
    pieces = list(windows)
    for block_start, block_end in blocks:
        remaining = []
        for piece_start, piece_end in pieces:
            if block_end <= piece_start or block_start >= piece_end:
                remaining.append((piece_start, piece_end))
                continue
            if block_start > piece_start:
                remaining.append((piece_start, block_start))
            if block_end < piece_end:
                remaining.append((block_end, piece_end))
        pieces = remaining
        if not pieces:
            break
    return pieces


def _count_active_by_local_day(bookings, listing, tz_by_resource):
    """`max_per_day`: reservas activas de este servicio por recurso y día local."""
    counts = {}
    for booking in bookings:
        if booking.listing_id != listing.id:
            continue
        tz = tz_by_resource.get(booking.resource_id)
        if tz is None:
            continue
        local_day = booking.start_at.astimezone(tz).date()
        key = (booking.listing_id, booking.resource_id, local_day)
        counts[key] = counts.get(key, 0) + 1
    return counts


# ---------------------------------------------------------------------------
# Algoritmo
# ---------------------------------------------------------------------------
def available_slots(*, account, listing, date_from, date_to, resource=None, now=None):
    """Slots disponibles por día entre `date_from` y `date_to`, ambos inclusive.

    Devuelve una lista de `DayAvailability` con **todos** los días del rango
    (los días sin hueco llevan `reason`). `now` existe solo como punto de
    inyección para los tests; en producción se usa el reloj.
    """
    service = listing.service_details
    if resource is not None:
        resources = [resource]
    else:
        resources = list(account.resources.filter(is_active=True).order_by('id'))

    step = timedelta(minutes=settings.BOOKING_SLOT_STEP_MINUTES)
    duration = timedelta(minutes=service.duration_minutes)
    occupied_len = duration + timedelta(minutes=service.buffer_minutes)
    now = now or timezone.now()
    min_notice_limit = now + timedelta(hours=service.min_notice_hours)

    tz_by_resource = {r.id: _zone(r.effective_timezone) for r in resources}
    range_start, range_end = _covering_utc_range(
        date_from, date_to, resources, tz_by_resource,
    )

    # Las cuatro consultas constantes del pseudocódigo normativo.
    rules = list(
        AvailabilityRule.objects.filter(resource__in=resources, is_active=True)
    )
    exceptions = list(
        AvailabilityException.objects.filter(
            resource__in=resources,
            starts_at__lt=range_end,
            ends_at__gt=range_start,
        )
    )
    bookings = list(
        Booking.objects.filter(
            resource__in=resources,
            start_at__lt=range_end,
            occupies_until__gt=range_start,
        ).filter(
            Q(status__in=ACTIVE_STATUSES)
            | Q(status=HOLDING_STATUS, hold_expires_at__gte=now)
        )
    )
    active_counts = _count_active_by_local_day(bookings, listing, tz_by_resource)
    bookings_by_resource = {}
    for booking in bookings:
        bookings_by_resource.setdefault(booking.resource_id, []).append(booking)

    days = []
    for day in _date_range(date_from, date_to):
        candidates = {}
        declared_windows = False
        remaining_windows = 0

        for resource in resources:
            tz = tz_by_resource[resource.id]
            day_start, day_end = _day_bounds_utc(day, tz)

            windows = []
            for rule in rules:
                if rule.resource_id != resource.id or rule.weekday != day.weekday():
                    continue
                if rule.valid_from and rule.valid_from > day:
                    continue
                if rule.valid_to and rule.valid_to < day:
                    continue
                windows.append((
                    datetime.combine(day, rule.start_time, tzinfo=tz).astimezone(UTC),
                    datetime.combine(day, rule.end_time, tzinfo=tz).astimezone(UTC),
                ))

            blocks = []
            for exception in exceptions:
                if exception.resource_id != resource.id:
                    continue
                if exception.ends_at <= day_start or exception.starts_at >= day_end:
                    continue
                # Las excepciones se recortan al día local: una de varios días
                # aporta a cada día solo su parte, no el rango completo.
                if exception.kind == AvailabilityException.Kind.EXTRA:
                    extra_start = max(exception.starts_at, day_start)
                    extra_end = min(exception.ends_at, day_end)
                    if extra_end > extra_start:
                        windows.append((extra_start, extra_end))
                else:
                    blocks.append((
                        max(exception.starts_at, day_start),
                        min(exception.ends_at, day_end),
                    ))

            if windows:
                declared_windows = True
            windows = _subtract(windows, blocks)
            remaining_windows += len(windows)

            if service.max_per_day is not None:
                used = active_counts.get((listing.id, resource.id, day), 0)
                if used >= service.max_per_day:
                    continue

            for window_start, window_end in windows:
                index = 0
                while window_start + index * step + duration <= window_end:
                    start = window_start + index * step
                    index += 1
                    if start < min_notice_limit:
                        continue
                    if _overlaps(
                        bookings_by_resource.get(resource.id, ()),
                        start,
                        start + occupied_len,
                    ):
                        continue
                    candidates[(resource.id, start)] = Slot(
                        start=start,
                        end=start + duration,
                        resource_id=resource.id,
                        resource_name=resource.name,
                    )

        ordered = [
            candidates[key]
            for key in sorted(candidates, key=lambda key: (key[1], key[0]))
        ][:MAX_SLOTS_PER_DAY]

        reason = None
        if not ordered:
            if not declared_windows:
                reason = 'fuera_de_horario'
            elif remaining_windows == 0:
                reason = 'excepcion_no_disponible'
            else:
                reason = 'sin_espacio'
        days.append(DayAvailability(day=day, slots=ordered, reason=reason))

    return days


def _overlaps(bookings, start, end):
    """Solapamiento con el rango ocupado del candidato, igual que la constraint."""
    return any(
        start < booking.occupies_until and booking.start_at < end
        for booking in bookings
    )
