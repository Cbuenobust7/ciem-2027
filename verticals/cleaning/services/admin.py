"""Admin de servicios de limpieza (§9.5)."""

from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from .models import ServiceDetails


@admin.register(ServiceDetails)
class ServiceDetailsAdmin(admin.ModelAdmin):
    list_display = (
        'listing', 'provider_account', 'duration_minutes', 'buffer_minutes',
        'min_notice_hours', 'max_per_day', 'is_active', 'enlace_al_anuncio',
    )
    list_filter = ('is_active', 'provider_account')
    search_fields = ('listing__title', 'provider_account__display_name')
    readonly_fields = ('enlace_al_anuncio',)

    @admin.display(description='Anuncio')
    def enlace_al_anuncio(self, obj):
        if obj is None or obj.listing_id is None:
            return '—'
        url = reverse('admin:marketplace_listings_listing_change', args=[obj.listing_id])
        return format_html('<a href="{}">{}</a>', url, obj.listing.title)
