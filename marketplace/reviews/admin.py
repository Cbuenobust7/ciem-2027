from django.contrib import admin

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'reviewer', 'seller', 'listing', 'rating', 'created_at',
    )
    list_filter = ('rating', 'created_at')
    search_fields = (
        'reviewer__email', 'reviewer__username',
        'seller__email', 'seller__username',
        'listing__title',
    )
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at')