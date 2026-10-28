from django.apps import AppConfig


class ListingsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'marketplace.listings'
    label = 'marketplace_listings'
    verbose_name = 'Marketplace Starter Listings'