"""Modelos de `cleaning_bookings` — la transacción.

Especificación: docs/CLEANING_VERTICAL_TECHNICAL_PLAN.md §3.4 (ADR-03, ADR-04,
ADR-06, ADR-08).

NOTA DE AUTORÍA (flujo 0001/0002 documentado en el Apéndice A de la
especificación): `Booking.Meta.constraints` NO incluye todavía la
`ExclusionConstraint`. Este archivo se migra primero sin ella para generar
`0001_initial`; después se añade y se crea `0002_booking_exclusion_constraint`.
"""

from datetime import timedelta

from django.conf import settings
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import RangeBoundary, RangeOperators
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from .expressions import TsTzRange


class BookingCodeSequence(models.Model):
    """Contador por año para el código visible `CL-2026-000123` (§3.4)."""

    year = models.PositiveSmallIntegerField(unique=True)
    next_value = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name = 'Secuencia de códigos de reserva'
        verbose_name_plural = 'Secuencias de códigos de reserva'

    def __str__(self):
        return f'{self.year} → {self.next_value}'


class Booking(models.Model):
    class Status(models.TextChoices):
        REQUESTED = 'requested', 'Solicitada'
        CONFIRMED = 'confirmed', 'Confirmada'
        IN_PROGRESS = 'in_progress', 'En ejecución'
        COMPLETED = 'completed', 'Completada'
        CANCELLED = 'cancelled', 'Cancelada'
        EXPIRED = 'expired', 'Expirada'

    class PaymentStatus(models.TextChoices):
        UNPAID = 'unpaid', 'Sin pago'
        DEPOSIT_PAID = 'deposit_paid', 'Depósito pagado'
        PAID = 'paid', 'Pagado'
        REFUNDED = 'refunded', 'Reembolsado'

    # Estados que ocupan agenda en el índice parcial de exclusión (ADR-04).
    ACTIVE_STATUSES = (Status.REQUESTED, Status.CONFIRMED, Status.IN_PROGRESS)

    code = models.CharField(max_length=20, unique=True)
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='bookings_as_customer',
    )
    account = models.ForeignKey(
        'cleaning_providers.ProviderAccount',
        on_delete=models.PROTECT,
        related_name='bookings',
    )
    resource = models.ForeignKey(
        'cleaning_providers.ProviderResource',
        on_delete=models.PROTECT,
        related_name='bookings',
    )
    listing = models.ForeignKey(
        'marketplace_listings.Listing',
        on_delete=models.PROTECT,
        related_name='bookings',
    )
    service_title = models.CharField(max_length=200)

    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    buffer_minutes = models.PositiveSmallIntegerField(default=0)
    occupies_until = models.DateTimeField()
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.REQUESTED,
    )
    hold_expires_at = models.DateTimeField(null=True, blank=True)

    address = models.TextField()
    district = models.CharField(max_length=80)
    city = models.ForeignKey(
        'marketplace_visibility.City',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True,
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True,
    )

    price = models.DecimalField(max_digits=10, decimal_places=2)
    zone_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default='PEN')
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    provider_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_status = models.CharField(
        max_length=16, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID,
    )
    payment = models.ForeignKey(
        'payments_core.Payment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings',
    )

    idempotency_key = models.CharField(max_length=128, null=True, blank=True)
    request_fingerprint = models.CharField(max_length=64, null=True, blank=True)
    customer_notes = models.TextField(blank=True)
    provider_notes = models.TextField(blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    cancel_reason = models.CharField(max_length=20, blank=True)
    cancel_detail = models.TextField(blank=True)

    confirmed_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Reserva'
        verbose_name_plural = 'Reservas'
        ordering = ['-start_at']
        constraints = [
            models.CheckConstraint(
                condition=Q(end_at__gt=F('start_at')), name='booking_time_order',
            ),
            models.CheckConstraint(
                condition=Q(occupies_until__gte=F('end_at')),
                name='booking_occupies_until_after_end',
            ),
            models.CheckConstraint(
                condition=(
                    Q(status='requested', hold_expires_at__isnull=False)
                    | (~Q(status='requested') & Q(hold_expires_at__isnull=True))
                ),
                name='booking_hold_matches_status',
            ),
            models.CheckConstraint(
                condition=Q(price__gte=0)
                & Q(platform_fee__gte=0)
                & Q(provider_amount__gte=0),
                name='booking_amounts_non_negative',
            ),
            models.CheckConstraint(
                condition=Q(price=F('platform_fee') + F('provider_amount')),
                name='booking_amounts_sum_to_price',
            ),
            models.UniqueConstraint(
                fields=['customer', 'idempotency_key'],
                condition=Q(idempotency_key__isnull=False),
                name='unique_booking_idempotency_per_customer',
            ),
            # ADR-04: la doble reserva la impide PostgreSQL, no Django. Se añade
            # en 0002_booking_exclusion_constraint (flujo 0001/0002 del Apéndice A)
            # y se declara aquí para que el estado del ORM y el de las migraciones
            # sigan sincronizados.
            ExclusionConstraint(
                name='booking_no_overlap_per_resource',
                expressions=[
                    (
                        TsTzRange('start_at', 'occupies_until', RangeBoundary()),
                        RangeOperators.OVERLAPS,
                    ),
                    ('resource', RangeOperators.EQUAL),
                ],
                condition=Q(status__in=['requested', 'confirmed', 'in_progress']),
            ),
        ]
        indexes = [
            models.Index(fields=['resource', 'start_at']),
            models.Index(fields=['account', 'status', 'start_at']),
            models.Index(fields=['customer', '-start_at']),
            models.Index(fields=['listing', 'start_at']),
            models.Index(fields=['status', 'hold_expires_at']),
            models.Index(fields=['account', 'status', 'hold_expires_at']),
        ]

    def __str__(self):
        return f'{self.code} · {self.get_status_display()}'

    def save(self, *args, **kwargs):
        """`occupies_until` es desnormalizado: `end_at + buffer` (ADR-04)."""
        if self.end_at is not None:
            self.occupies_until = self.end_at + timedelta(
                minutes=self.buffer_minutes or 0,
            )
        update_fields = kwargs.get('update_fields')
        if update_fields is not None:
            kwargs['update_fields'] = set(update_fields) | {'occupies_until'}
        super().save(*args, **kwargs)

    @property
    def is_hold_expired(self):
        return (
            self.status == self.Status.REQUESTED
            and self.hold_expires_at is not None
            and self.hold_expires_at < timezone.now()
        )


class BookingEvent(models.Model):
    """Auditoría de transiciones: quién, cuándo, de qué estado a cuál y por qué."""

    class EventType(models.TextChoices):
        STATUS = 'status', 'Estado'
        PAYMENT = 'payment', 'Pago'

    booking = models.ForeignKey(
        Booking, on_delete=models.CASCADE, related_name='events',
    )
    from_status = models.CharField(max_length=12, blank=True)
    to_status = models.CharField(max_length=12)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    event_type = models.CharField(
        max_length=12, choices=EventType.choices, default=EventType.STATUS,
    )
    actor_role = models.CharField(max_length=20, blank=True)
    reason = models.CharField(max_length=160, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Evento de reserva'
        verbose_name_plural = 'Eventos de reserva'
        ordering = ['created_at']
        indexes = [models.Index(fields=['booking', 'created_at'])]

    def __str__(self):
        return f'{self.booking_id}: {self.from_status or "—"} → {self.to_status}'
