from django.db import models

from creatorhub_core.users.models import CreatorHubUser


class User(CreatorHubUser):
    """
    Usuario concreto de Marketplace Starter.
    Hereda de CreatorHubUser y añade campos específicos.
    """
    is_seller = models.BooleanField(default=False)
    is_buyer = models.BooleanField(default=True)
    preferred_city = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'marketplace_users'
        verbose_name = 'Marketplace User'
        verbose_name_plural = 'Marketplace Users'
