from django.contrib import admin
from django.utils import timezone

from .models import Listing, ListingImage


class ListingImageInline(admin.TabularInline):
    model = ListingImage
    extra = 1
    readonly_fields = ('created_at',)


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'title', 'seller', 'price', 'currency',
        'status', 'condition', 'location', 'reviewed_at', 'reviewed_by', 'view_count', 'created_at',
    )
    list_filter = ('status', 'condition', 'currency', 'created_at', 'reviewed_by')
    search_fields = ('title', 'description', 'seller__email', 'seller__username')
    ordering = ('-created_at',)
    readonly_fields = ('view_count', 'favorite_count', 'created_at', 'updated_at', 'published_at', 'reviewed_at', 'reviewed_by')
    actions = ('approve_selected_services',)
    def save_model(self, request, obj, form, change):
        if change:
            previous = Listing.objects.filter(pk=obj.pk).values('status').first()
            if previous and previous['status'] != obj.status and obj.status in {'active', 'rejected'}:
                obj.reviewed_at = timezone.now()
                obj.reviewed_by = request.user
                if obj.status == 'active' and obj.published_at is None:
                    obj.published_at = obj.reviewed_at
        super().save_model(request, obj, form, change)


    @admin.action(description='Aprobar servicios seleccionados')
    def approve_selected_services(self, request, queryset):
        for listing in queryset.filter(service_details__isnull=False, status='pending_review'):
            listing.approve(request.user)
    inlines = [ListingImageInline]


@admin.register(ListingImage)
class ListingImageAdmin(admin.ModelAdmin):
    list_display = ('id', 'listing', 'is_cover', 'order', 'created_at')
    list_filter = ('is_cover',)
    search_fields = ('listing__title',)