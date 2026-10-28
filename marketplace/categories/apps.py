from django.apps import AppConfig


class CategoriesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'marketplace.categories'
    label = 'marketplace_categories'
    verbose_name = 'Marketplace Starter Categories'