"""Admin de reservas (§9.5).

Los estados **no** se editan a mano: `status` y `payment_status` son
`readonly_fields` y los cambios se hacen con acciones que llaman a los servicios
de §4.1. Es la única forma de que `BookingEvent` sea una auditoría fiable.
"""

from django.contrib import admin, messages

from verticals.cleaning.errors import CleaningAPIError

from . import services
from .models import Booking, BookingEvent


class BookingEventInline(admin.TabularInline):
    model = BookingEvent
    extra = 0
    can_delete = False
    fields = (
        'created_at', 'event_type', 'from_status', 'to_status',
        'actor', 'actor_role', 'reason',
    )
    readonly_fields = fields
    ordering = ('created_at',)

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        'code', 'start_at', 'account', 'resource', 'status',
        'payment_status', 'price',
    )
    list_filter = ('status', 'payment_status', 'account')
    search_fields = ('code', 'customer__email', 'address')
    date_hierarchy = 'start_at'
    ordering = ('-start_at',)
    inlines = [BookingEventInline]
    readonly_fields = (
        'code', 'status', 'payment_status', 'customer', 'account', 'resource',
        'listing', 'service_title', 'start_at', 'end_at', 'buffer_minutes',
        'occupies_until', 'hold_expires_at', 'price', 'zone_fee', 'currency',
        'platform_fee', 'provider_amount', 'deposit_amount', 'payment',
        'idempotency_key', 'request_fingerprint', 'confirmed_at', 'started_at',
        'completed_at', 'cancelled_at', 'cancelled_by', 'created_at',
        'updated_at',
    )
    actions = (
        'accion_confirmar', 'accion_cancelar', 'accion_completar',
        'accion_liberar_bloqueos',
    )

    def has_add_permission(self, request):
        # Las reservas nacen en la API, nunca a mano en el admin.
        return False

    @admin.action(description='Confirmar las reservas seleccionadas')
    def accion_confirmar(self, request, queryset):
        self._aplicar(
            request, queryset,
            lambda booking: services.confirm_booking(
                booking=booking, actor=request.user, role='platform',
            ),
            'confirmada(s)',
        )

    @admin.action(description='Cancelar las reservas seleccionadas')
    def accion_cancelar(self, request, queryset):
        def cancelar(booking):
            reason = (
                'incident' if booking.status == Booking.Status.IN_PROGRESS
                else 'provider'
            )
            return services.cancel_booking(
                booking=booking, actor=request.user, role='platform',
                reason=reason, detail='Cancelada desde el admin',
            )

        self._aplicar(request, queryset, cancelar, 'cancelada(s)')

    @admin.action(description='Completar las reservas seleccionadas')
    def accion_completar(self, request, queryset):
        self._aplicar(
            request, queryset,
            lambda booking: services.complete_booking(
                booking=booking, actor=request.user, role='platform',
            ),
            'completada(s)',
        )

    @admin.action(description='Liberar bloqueos vencidos (ADR-06)')
    def accion_liberar_bloqueos(self, request, queryset):
        total = services.expire_all_holds()
        self.message_user(
            request, f'{total} bloqueo(s) vencidos liberados.', messages.SUCCESS,
        )

    def _aplicar(self, request, queryset, transicion, etiqueta):
        """Ejecuta una transición por fila y reporta los rechazos de dominio."""
        aplicadas, rechazadas = 0, 0
        for booking in queryset:
            try:
                transicion(booking)
                aplicadas += 1
            except CleaningAPIError as exc:
                rechazadas += 1
                self.message_user(
                    request,
                    f'{booking.code}: {exc.code} — {exc.detail}',
                    messages.ERROR,
                )
        if aplicadas:
            self.message_user(
                request, f'{aplicadas} reserva(s) {etiqueta}.', messages.SUCCESS,
            )
        if rechazadas:
            self.message_user(
                request,
                f'{rechazadas} reserva(s) no cambiaron: transición no permitida.',
                messages.WARNING,
            )


@admin.register(BookingEvent)
class BookingEventAdmin(admin.ModelAdmin):
    list_display = (
        'booking', 'created_at', 'event_type', 'from_status', 'to_status',
        'actor', 'actor_role', 'reason',
    )
    list_filter = ('event_type', 'actor_role')
    search_fields = ('booking__code', 'reason')
    readonly_fields = (
        'booking', 'event_type', 'from_status', 'to_status', 'actor',
        'actor_role', 'reason', 'created_at',
    )

    def has_add_permission(self, request):
        return False
