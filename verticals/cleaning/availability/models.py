"""Modelos de `cleaning_availability` — cuándo se puede.

Especificación: docs/CLEANING_VERTICAL_TECHNICAL_PLAN.md §3.3 (ADR-05, ADR-07).
Las reglas son ventanas semanales en hora local del recurso; los slots se
calculan al vuelo y nunca se materializan en el MVP.
"""

from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models
from django.db.models import F, Q


class AvailabilityRule(models.Model):
    """Ventana semanal recurrente, en hora local del recurso."""

    resource = models.ForeignKey(
        'cleaning_providers.ProviderResource',
        on_delete=models.CASCADE,
        related_name='availability_rules',
    )
    weekday = models.PositiveSmallIntegerField(
        validators=[MaxValueValidator(6)], help_text='0 = lunes, 6 = domingo',
    )
    start_time = models.TimeField()
    end_time = models.TimeField()
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Regla de disponibilidad'
        verbose_name_plural = 'Reglas de disponibilidad'
        ordering = ['resource', 'weekday', 'start_time']
        constraints = [
            models.CheckConstraint(
                condition=Q(end_time__gt=F('start_time')),
                name='availability_rule_time_order',
            ),
            models.CheckConstraint(
                condition=Q(valid_from__isnull=True)
                | Q(valid_to__isnull=True)
                | Q(valid_to__gte=F('valid_from')),
                name='availability_rule_date_order',
            ),
        ]
        indexes = [models.Index(fields=['resource', 'weekday', 'is_active'])]

    def __str__(self):
        return f'{self.resource} · día {self.weekday} {self.start_time}-{self.end_time}'


class AvailabilityException(models.Model):
    """Vacaciones, feriados, refuerzos puntuales."""

    class Kind(models.TextChoices):
        UNAVAILABLE = 'unavailable', 'No disponible'
        EXTRA = 'extra_available', 'Disponible extra'

    resource = models.ForeignKey(
        'cleaning_providers.ProviderResource',
        on_delete=models.CASCADE,
        related_name='availability_exceptions',
    )
    kind = models.CharField(
        max_length=16, choices=Kind.choices, default=Kind.UNAVAILABLE,
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    reason = models.CharField(max_length=160, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Excepción de disponibilidad'
        verbose_name_plural = 'Excepciones de disponibilidad'
        constraints = [
            models.CheckConstraint(
                condition=Q(ends_at__gt=F('starts_at')),
                name='availability_exception_time_order',
            ),
        ]
        indexes = [
            models.Index(fields=['resource', 'starts_at']),
            models.Index(fields=['resource', 'kind', 'starts_at']),
        ]

    def __str__(self):
        return f'{self.resource} · {self.get_kind_display()} {self.starts_at:%Y-%m-%d %H:%M}'
