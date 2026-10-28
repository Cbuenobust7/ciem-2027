from django.contrib.auth.models import AbstractUser
from django.db import models


class CreatorHubUser(AbstractUser):
    """
    Base abstracta de identidad para los productos CreatorHub.

    Cada producto define su propio modelo User concreto heredando
    de esta clase.
    """

    email = models.EmailField(unique=True)

    is_verified = models.BooleanField(default=False)

    class Meta:
        abstract = True
