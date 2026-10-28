"""Modelos de `cleaning_services` — qué se vende.

Especificación: docs/CLEANING_VERTICAL_TECHNICAL_PLAN.md §3.2 (ADR-02).
El servicio es un `Listing` del paquete base más los atributos operativos de la
vertical; la taxonomía se reutiliza desde `marketplace.categories`.
"""

from django.core.exceptions import ValidationError
from django.db import models


class ServiceDetails(models.Model):
    """Atributos operativos de un servicio publicado como `Listing`."""

    listing = models.OneToOneField(
        'marketplace_listings.Listing',
        on_delete=models.CASCADE,
        related_name='service_details',
    )
    provider_account = models.ForeignKey(
        'cleaning_providers.ProviderAccount',
        on_delete=models.PROTECT,
        related_name='services',
    )
    duration_minutes = models.PositiveSmallIntegerField()
    buffer_minutes = models.PositiveSmallIntegerField(default=30)
    capacity = models.PositiveSmallIntegerField(default=1)
    min_notice_hours = models.PositiveSmallIntegerField(default=12)
    max_horizon_days = models.PositiveSmallIntegerField(default=30)
    cancellation_hours = models.PositiveSmallIntegerField(default=24)
    requires_deposit = models.BooleanField(default=False)
    deposit_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
    )
    resolves_address = models.BooleanField(default=True)
    is_instant = models.BooleanField(default=False)
    max_per_day = models.PositiveSmallIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Detalle de servicio'
        verbose_name_plural = 'Detalles de servicio'
        indexes = [
            models.Index(fields=['provider_account', 'is_active']),
        ]

    def __str__(self):
        return f'{self.listing} ({self.duration_minutes} min)'

    def clean(self):
        """Reglas de §3.2. Se invocan desde `full_clean()` y los serializers."""
        errors = {}
        if not 1 <= self.duration_minutes <= 720:
            errors['duration_minutes'] = (
                'La duración debe estar entre 1 y 720 minutos.'
            )
        if not 0 <= self.buffer_minutes <= 240:
            errors['buffer_minutes'] = (
                'El buffer debe estar entre 0 y 240 minutos.'
            )
        if self.min_notice_hours > self.max_horizon_days * 24:
            errors['min_notice_hours'] = (
                'El aviso mínimo no puede superar el horizonte de reserva.'
            )
        if self.listing_id and self.requires_deposit:
            price = self.listing.price or 0
            if self.deposit_amount > price:
                errors['deposit_amount'] = (
                    'El depósito no puede ser mayor que el precio del servicio.'
                )
        if self.listing_id and self.listing.status == 'sold':
            errors['listing'] = (
                'Un servicio no puede publicarse como "sold" (ADR-03).'
            )
        if errors:
            raise ValidationError(errors)
