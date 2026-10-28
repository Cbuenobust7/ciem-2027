from django.contrib import admin

from .models import City, VisibilityPurchase


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = (
        "name", "slug", "premium_slots_count",
        "price", "currency", "is_promo_mode", "is_active",
    )
    list_filter = ("is_promo_mode", "is_active", "currency")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("name",)


@admin.register(VisibilityPurchase)
class VisibilityPurchaseAdmin(admin.ModelAdmin):
    list_display = (
        "id", "seller", "city", "position",
        "status", "price", "currency", "starts_at", "ends_at",
    )
    list_filter = ("status", "is_promo", "city", "currency")
    search_fields = ("seller__email", "seller__username", "city__name")
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "updated_at")