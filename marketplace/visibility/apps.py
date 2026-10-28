from django.apps import AppConfig


class VisibilityConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'marketplace.visibility'
    label = 'marketplace_visibility'
    verbose_name = 'Marketplace Starter Visibility'

    def ready(self):
        import marketplace.visibility.signals  # noqa