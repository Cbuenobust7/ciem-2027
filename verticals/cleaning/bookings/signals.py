"""Señales de `cleaning_bookings`.

`payment_completed` con `payment_type='booking'` confirma la reserva (transición
1 desde el sistema, §4.1) y registra el dinero. Un pago de otro tipo —por
ejemplo `visibility`— **no** toca ninguna reserva.

Un reembolso no des-confirma: eso se hace cancelando explícitamente (§4.1).
"""

from django.db import transaction
from django.dispatch import receiver
from django.utils import timezone

from creatorhub_core.payments_core.signals import payment_completed

from .models import Booking, BookingEvent


def _resolve_booking(payment):
    """Localiza la reserva del pago por `external_reference` o `metadata`."""
    code = (payment.external_reference or '').strip()
    if not code:
        code = str((payment.metadata or {}).get('booking_code', '')).strip()
    if not code:
        return None
    return Booking.objects.filter(code=code).first()


@receiver(payment_completed)
def on_payment_completed(sender, payment, **kwargs):
    if payment.payment_type != 'booking':
        return
    booking = _resolve_booking(payment)
    if booking is None:
        return

    with transaction.atomic():
        booking = Booking.objects.select_for_update().get(pk=booking.pk)
        now = timezone.now()
        booking.payment = payment
        booking.payment_status = (
            Booking.PaymentStatus.PAID
            if payment.amount >= booking.price
            else Booking.PaymentStatus.DEPOSIT_PAID
        )
        update_fields = ['payment', 'payment_status', 'updated_at']

        hold_valid = (
            booking.hold_expires_at is None or booking.hold_expires_at >= now
        )
        if booking.status == Booking.Status.REQUESTED and hold_valid:
            previous = booking.status
            booking.status = Booking.Status.CONFIRMED
            booking.confirmed_at = now
            booking.hold_expires_at = None
            update_fields += ['status', 'confirmed_at', 'hold_expires_at']
            BookingEvent.objects.create(
                booking=booking,
                from_status=previous,
                to_status=booking.status,
                actor=None,
                actor_role='system',
                reason='payment_completed',
            )

        booking.save(update_fields=update_fields)

        BookingEvent.objects.create(
            booking=booking,
            from_status=booking.status,
            to_status=booking.status,
            actor=None,
            actor_role='system',
            reason=f'payment:{payment.status}',
            event_type=BookingEvent.EventType.PAYMENT,
        )
