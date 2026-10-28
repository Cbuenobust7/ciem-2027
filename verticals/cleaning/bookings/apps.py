from django.apps import AppConfig


class BookingsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'verticals.cleaning.bookings'
    label = 'cleaning_bookings'
    verbose_name = 'Limpieza · Reservas'

    def ready(self):
        # Registra el receptor de `payment_completed` para las reservas.
        from . import signals  # noqa: F401
