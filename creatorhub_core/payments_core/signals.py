# creatorhub_core/payments_core/signals.py
from django.dispatch import Signal

# kwargs enviados: payment (instancia de Payment)
payment_completed = Signal()
payment_failed = Signal()
payment_refunded = Signal()