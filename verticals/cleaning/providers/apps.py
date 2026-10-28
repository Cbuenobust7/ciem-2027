from django.apps import AppConfig


class ProvidersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'verticals.cleaning.providers'
    label = 'cleaning_providers'
    verbose_name = 'Limpieza · Proveedores'

    def ready(self):
        # Registra la señal que crea el recurso "Principal" de cada cuenta.
        from . import signals  # noqa: F401
