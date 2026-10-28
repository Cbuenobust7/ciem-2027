"""Admin de proveedores (§9.5).

La relación comercial (`participation_status`), la publicación, las
reclamaciones y las correcciones se gestionan aquí en el MVP. Las acciones
llaman a `providers.services` para que cada cambio quede auditado.
"""

from django.contrib import admin, messages

from verticals.cleaning.errors import CleaningAPIError

from . import services as provider_services
from .models import (
    DirectoryCorrectionRequest,
    ProviderAccount,
    ProviderClaim,
    ProviderMembership,
    ProviderResource,
    ProviderServiceArea,
    ProviderStatusEvent,
)


class ProviderMembershipInline(admin.TabularInline):
    model = ProviderMembership
    extra = 0
    fields = ('user', 'role', 'is_active', 'created_at')
    readonly_fields = ('created_at',)


class ProviderResourceInline(admin.TabularInline):
    model = ProviderResource
    extra = 0
    fields = ('name', 'kind', 'timezone', 'capacity', 'is_active')
    show_change_link = True


class ProviderServiceAreaInline(admin.TabularInline):
    model = ProviderServiceArea
    extra = 0
    fields = ('city', 'district', 'district_label', 'extra_fee', 'is_active')


@admin.register(ProviderAccount)
class ProviderAccountAdmin(admin.ModelAdmin):
    list_display = (
        'display_name', 'participation_status', 'is_published', 'kind',
        'owner', 'verification_status', 'is_active', 'rating_avg',
    )
    list_filter = (
        'participation_status', 'is_published', 'verification_status',
        'kind', 'is_active',
    )
    search_fields = ('display_name', 'legal_name', 'tax_id', 'owner__email')
    prepopulated_fields = {'slug': ('display_name',)}
    readonly_fields = (
        'rating_avg', 'rating_count', 'verified_at', 'created_at', 'updated_at',
    )
    filter_horizontal = ('service_categories',)
    inlines = [
        ProviderMembershipInline,
        ProviderResourceInline,
        ProviderServiceAreaInline,
    ]
    fieldsets = (
        ('Relación comercial', {
            'fields': (
                'participation_status', 'is_published', 'owner', 'kind',
                'verification_status', 'verified_at', 'verified_by',
            ),
        }),
        ('Datos públicos', {
            'fields': (
                'display_name', 'slug', 'legal_name', 'tax_id', 'description',
                'logo', 'phone', 'contact_email', 'address', 'website',
                'whatsapp', 'instagram', 'facebook', 'timezone',
            ),
        }),
        ('Ficha de directorio', {
            'fields': (
                'services_summary', 'service_categories', 'media_authorized',
                'media_source',
            ),
        }),
        ('Procedencia y revisión', {
            'fields': (
                'source_name', 'source_url', 'source_retrieved_at',
                'last_reviewed_at', 'reviewed_by', 'internal_notes',
            ),
        }),
        ('Condiciones y métricas', {
            'fields': (
                'terms_accepted_at', 'terms_version', 'rating_avg',
                'rating_count', 'created_at', 'updated_at',
            ),
        }),
    )
    actions = (
        'publish_selected', 'unpublish_selected', 'retire_selected',
    )

    def _run(self, request, queryset, func, **kwargs):
        done, errors = 0, 0
        for account in queryset:
            try:
                func(account, request.user, **kwargs)
                done += 1
            except CleaningAPIError as exc:
                errors += 1
                self.message_user(
                    request,
                    f'{account.display_name}: {exc.detail}',
                    level=messages.ERROR,
                )
        if done:
            self.message_user(
                request,
                f'{done} ficha(s) actualizada(s).',
                level=messages.SUCCESS,
            )
        return errors

    @admin.action(description='Publicar fichas seleccionadas')
    def publish_selected(self, request, queryset):
        self._run(request, queryset, provider_services.set_publication, published=True)

    @admin.action(description='Despublicar fichas seleccionadas')
    def unpublish_selected(self, request, queryset):
        self._run(request, queryset, provider_services.set_publication, published=False)

    @admin.action(description='Retirar fichas seleccionadas del directorio')
    def retire_selected(self, request, queryset):
        self._run(request, queryset, provider_services.retire_provider)


@admin.register(ProviderClaim)
class ProviderClaimAdmin(admin.ModelAdmin):
    list_display = (
        'account', 'claimant', 'status', 'created_at', 'reviewed_at',
    )
    list_filter = ('status', 'created_at')
    search_fields = (
        'account__display_name', 'claimant__email', 'contact_email',
    )
    readonly_fields = (
        'account', 'claimant', 'status', 'contact_email', 'contact_phone',
        'message', 'evidence_url', 'terms_accepted', 'created_at',
        'reviewed_by', 'reviewed_at', 'decision_note',
    )
    actions = ('approve_selected', 'reject_selected')

    def has_add_permission(self, request):
        return False

    @admin.action(description='Aprobar reclamaciones seleccionadas')
    def approve_selected(self, request, queryset):
        done = 0
        for claim in queryset:
            try:
                provider_services.approve_claim(
                    claim, request.user, note='Aprobada desde el admin.',
                )
                done += 1
            except CleaningAPIError as exc:
                self.message_user(request, exc.detail, level=messages.ERROR)
        if done:
            self.message_user(
                request,
                f'{done} reclamación(es) aprobada(s).',
                level=messages.SUCCESS,
            )

    @admin.action(description='Rechazar reclamaciones seleccionadas')
    def reject_selected(self, request, queryset):
        done = 0
        for claim in queryset:
            try:
                provider_services.reject_claim(
                    claim, request.user, note='Rechazada desde el admin.',
                )
                done += 1
            except CleaningAPIError as exc:
                self.message_user(request, exc.detail, level=messages.ERROR)
        if done:
            self.message_user(
                request,
                f'{done} reclamación(es) rechazada(s).',
                level=messages.SUCCESS,
            )


@admin.register(DirectoryCorrectionRequest)
class DirectoryCorrectionRequestAdmin(admin.ModelAdmin):
    list_display = (
        'account', 'kind', 'requester_email', 'status', 'created_at',
    )
    list_filter = ('kind', 'status', 'created_at')
    search_fields = (
        'account__display_name', 'requester_email', 'requester_name',
    )
    readonly_fields = (
        'account', 'kind', 'requester_name', 'requester_email',
        'requester_phone', 'message', 'status', 'created_at',
        'resolved_by', 'resolved_at', 'resolution_note',
    )
    actions = ('resolve_selected', 'reject_selected')

    def has_add_permission(self, request):
        return False

    @admin.action(description='Resolver solicitudes seleccionadas')
    def resolve_selected(self, request, queryset):
        done = 0
        for correction in queryset:
            try:
                provider_services.resolve_correction(
                    correction,
                    request.user,
                    note='Resuelta desde el admin.',
                    remove=correction.kind == DirectoryCorrectionRequest.Kind.REMOVAL,
                )
                done += 1
            except CleaningAPIError as exc:
                self.message_user(request, exc.detail, level=messages.ERROR)
        if done:
            self.message_user(
                request,
                f'{done} solicitud(es) resuelta(s).',
                level=messages.SUCCESS,
            )

    @admin.action(description='Rechazar solicitudes seleccionadas')
    def reject_selected(self, request, queryset):
        done = 0
        for correction in queryset:
            try:
                provider_services.reject_correction(
                    correction, request.user, note='Rechazada desde el admin.',
                )
                done += 1
            except CleaningAPIError as exc:
                self.message_user(request, exc.detail, level=messages.ERROR)
        if done:
            self.message_user(
                request,
                f'{done} solicitud(es) rechazada(s).',
                level=messages.SUCCESS,
            )


@admin.register(ProviderStatusEvent)
class ProviderStatusEventAdmin(admin.ModelAdmin):
    list_display = (
        'account', 'event_type', 'from_status', 'to_status', 'actor',
        'created_at',
    )
    list_filter = ('event_type', 'to_status', 'created_at')
    search_fields = ('account__display_name', 'reason', 'actor__email')
    readonly_fields = (
        'account', 'event_type', 'from_status', 'to_status', 'actor',
        'reason', 'metadata', 'created_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ProviderResource)
class ProviderResourceAdmin(admin.ModelAdmin):
    list_display = ('name', 'account', 'kind', 'capacity', 'is_active')
    list_filter = ('kind', 'is_active', 'account')
    search_fields = ('name', 'account__display_name')
    filter_horizontal = ('members',)


@admin.register(ProviderServiceArea)
class ProviderServiceAreaAdmin(admin.ModelAdmin):
    list_display = ('account', 'city', 'district', 'district_label', 'extra_fee', 'is_active')
    list_filter = ('is_active', 'city')
    search_fields = ('district', 'district_label', 'account__display_name')


@admin.register(ProviderMembership)
class ProviderMembershipAdmin(admin.ModelAdmin):
    list_display = ('account', 'user', 'role', 'is_active', 'created_at')
    list_filter = ('role', 'is_active')
    search_fields = ('user__email', 'account__display_name')
