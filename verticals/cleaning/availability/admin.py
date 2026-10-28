"""Admin de disponibilidad (§9.5).

El aviso de solapamiento es **informativo**: las reglas pueden solaparse a
propósito (08:00–12:00 y 11:00–15:00 los sábados) y el cálculo deduplica los
slots con un `set`. No se bloquea el guardado (ADR-05).
"""

from django.contrib import admin

from .models import AvailabilityException, AvailabilityRule


@admin.register(AvailabilityRule)
class AvailabilityRuleAdmin(admin.ModelAdmin):
    list_display = (
        'resource', 'weekday', 'start_time', 'end_time', 'valid_from',
        'valid_to', 'is_active', 'aviso_solapamiento',
    )
    list_filter = ('is_active', 'weekday', 'resource__account')
    search_fields = ('resource__name', 'resource__account__display_name')
    readonly_fields = ('aviso_solapamiento',)

    @admin.display(description='Solapamiento (informativo)')
    def aviso_solapamiento(self, obj):
        if obj is None or obj.pk is None:
            return '—'
        otras = AvailabilityRule.objects.filter(
            resource=obj.resource, weekday=obj.weekday, is_active=True,
        ).exclude(pk=obj.pk)
        choques = [
            otra for otra in otras
            if otra.start_time < obj.end_time and obj.start_time < otra.end_time
        ]
        if not choques:
            return 'Sin solapes'
        detalle = ', '.join(
            f'{otra.start_time:%H:%M}–{otra.end_time:%H:%M}' for otra in choques
        )
        return f'Solapa con {detalle} (permitido)'


@admin.register(AvailabilityException)
class AvailabilityExceptionAdmin(admin.ModelAdmin):
    list_display = ('resource', 'kind', 'starts_at', 'ends_at', 'reason', 'created_by')
    list_filter = ('kind', 'resource__account')
    search_fields = ('resource__name', 'reason')
    date_hierarchy = 'starts_at'
    readonly_fields = ('created_at',)
