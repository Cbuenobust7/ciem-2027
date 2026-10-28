from django.db.models import F
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from marketplace.listings.models import Listing

from .models import Favorite


@receiver(post_save, sender=Favorite)
def increment_favorite_count(sender, instance, created, **kwargs):
    if created:
        Listing.objects.filter(pk=instance.listing_id).update(
            favorite_count=F("favorite_count") + 1
        )


@receiver(post_delete, sender=Favorite)
def decrement_favorite_count(sender, instance, **kwargs):
    Listing.objects.filter(pk=instance.listing_id).update(
        favorite_count=F("favorite_count") - 1
    )