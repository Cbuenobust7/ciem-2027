"""Señales de `cleaning_providers`.

1. Al crear una `ProviderAccount` se crea el recurso "Principal" (§3.1): el caso
   independiente funciona sin que el usuario sepa que existen los recursos.
2. Al cambiar la titularidad se reasigna el `seller` de sus servicios, para
   mantener la invariante de §6.3:
   `listing.seller_id == listing.service_details.provider_account.owner_id`.
3. La reputación de la cuenta (`rating_avg`/`rating_count`) se recalcula por
   señal a partir de las reseñas **verificadas** (ADR-09), con el mismo patrón
   desnormalizado que `Listing.favorite_count`.
"""

from decimal import Decimal

from django.db.models import Avg, Count
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from marketplace.listings.models import Listing
from marketplace.reviews.models import Review
from verticals.cleaning.bookings.models import Booking

from .models import ProviderAccount, ProviderResource


@receiver(post_save, sender=ProviderAccount)
def ensure_primary_resource(sender, instance, created, **kwargs):
    if not created:
        return
    # Una ficha de directorio no tiene agenda; el recurso nace al convertirse
    # en proveedor asociado (aprobación de reclamación o alta).
    if instance.owner_id is None or not instance.can_operate:
        return
    ProviderResource.objects.get_or_create(
        account=instance,
        name='Principal',
        defaults={'kind': ProviderResource.Kind.CREW},
    )


@receiver(pre_save, sender=ProviderAccount)
def remember_previous_owner(sender, instance, **kwargs):
    """Guarda el titular anterior: es lo único que permite detectar el cambio."""
    if instance.pk is None:
        instance._previous_owner_id = None
        return
    instance._previous_owner_id = (
        ProviderAccount.objects
        .filter(pk=instance.pk)
        .values_list('owner_id', flat=True)
        .first()
    )


@receiver(post_save, sender=ProviderAccount)
def reassign_listing_sellers(sender, instance, created, **kwargs):
    """Transferencia de titularidad: los servicios pasan al nuevo dueño (§6.3)."""
    if created:
        return
    previous = getattr(instance, '_previous_owner_id', None)
    if previous is None or previous == instance.owner_id:
        return
    # Una ficha sin titular no puede ser `seller` de ningún listing.
    if instance.owner_id is None:
        return
    Listing.objects.filter(
        service_details__provider_account=instance,
    ).update(seller=instance.owner)


def refresh_account_rating(account):
    """Recalcula el agregado con las reseñas de reservas completadas."""
    aggregates = Review.objects.filter(
        booking__account=account,
        booking__status=Booking.Status.COMPLETED,
    ).aggregate(media=Avg('rating'), total=Count('id'))
    account.rating_count = aggregates['total'] or 0
    account.rating_avg = (
        Decimal(str(aggregates['media'])).quantize(Decimal('0.01'))
        if aggregates['media'] is not None else Decimal('0.00')
    )
    account.save(update_fields=['rating_avg', 'rating_count'])


@receiver([post_save, post_delete], sender=Review)
def refresh_rating_on_review_change(sender, instance, **kwargs):
    booking = getattr(instance, 'booking', None)
    if booking is None:
        return
    refresh_account_rating(booking.account)
