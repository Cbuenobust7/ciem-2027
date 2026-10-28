from django.contrib import admin

from .models import Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'name', 'slug', 'parent', 'order', 'is_active', 'created_at',
    )
    list_filter = ('is_active', 'parent', 'created_at')
    search_fields = ('name', 'slug')
    ordering = ('order', 'name')
    readonly_fields = ('created_at', 'updated_at')
    prepopulated_fields = {'slug': ('name',)}

    fieldsets = (
        ('Información básica', {
            'fields': ('name', 'slug', 'parent', 'icon')
        }),
        ('Configuración', {
            'fields': ('order', 'is_active')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )