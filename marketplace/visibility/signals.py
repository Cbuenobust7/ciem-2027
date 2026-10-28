from django.dispatch import receiver

from creatorhub_core.payments_core.signals import payment_completed

from .services import activate_purchase_from_payment


@receiver(payment_completed)
def on_payment_completed(sender, payment, **kwargs):
    """
    Cuando se completa un pago de visibilidad, activa la compra.
    Solo procesa pagos cuyo payment_type sea 'visibility'.
    """
    if payment.payment_type != 'visibility':
        return

    activate_purchase_from_payment(payment)