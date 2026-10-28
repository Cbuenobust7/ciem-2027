from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'username', 'is_verified', 'is_seller', 'is_buyer', 'is_active', 'date_joined')
    list_filter = ('is_verified', 'is_seller', 'is_buyer', 'is_active', 'is_staff')
    search_fields = ('email', 'username')
    ordering = ('-date_joined',)

    fieldsets = BaseUserAdmin.fieldsets + (
        ('Marketplace Starter', {
            'fields': ('is_verified', 'is_seller', 'is_buyer', 'preferred_city')
        }),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Marketplace Starter', {
            'fields': ('email', 'is_verified', 'is_seller', 'is_buyer', 'preferred_city')
        }),
    )
