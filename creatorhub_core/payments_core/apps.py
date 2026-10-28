from django.apps import AppConfig


class PaymentsCoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'creatorhub_core.payments_core'
    label = 'payments_core'
    verbose_name = 'CreatorHub Payments Core'