from django.conf import settings
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    is_ciem_manager = serializers.SerializerMethodField()

    def get_is_ciem_manager(self, obj):
        return bool(obj.is_staff and obj.is_active)

    """Usuario autenticado, con su rol de la vertical resuelto en el servidor.

    El rol **no** sale de los flags vestigiales `is_seller`/`is_buyer`, sino de
    `ProviderMembership` (ADR-11). Con la vertical desactivada los tres campos
    nuevos van vacíos y `can_publish` recupera la regla del paquete base.
    """

    is_provider = serializers.SerializerMethodField()
    can_publish = serializers.SerializerMethodField()
    provider_accounts = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'is_ciem_manager',
            'id',
            'email',
            'username',
            'first_name',
            'last_name',
            'is_verified',
            'is_seller',
            'is_buyer',
            'preferred_city',
            'date_joined',
            # Vertical de limpieza (ADR-11): alimenta el enrutado del frontend.
            'is_provider',
            'can_publish',
            'provider_accounts',
        ]
        read_only_fields = [
            'id',
            'is_verified',
            'date_joined',
            'is_provider',
            'can_publish',
            'provider_accounts',
        ]

    def _vertical_enabled(self):
        return getattr(settings, 'CLEANING_VERTICAL_ENABLED', False)

    def get_is_provider(self, obj):
        if not self._vertical_enabled():
            return False
        from verticals.cleaning.providers.permissions import is_provider_user

        return is_provider_user(obj)

    def get_can_publish(self, obj):
        if getattr(settings, "CIEM_CATALOG_ONLY", False):
            return bool(obj.is_staff and obj.is_active)

        """Con la vertical apagada, cualquier autenticado publica (base original)."""
        if not self._vertical_enabled():
            return bool(obj.is_authenticated)
        if obj.is_staff:
            return True
        from verticals.cleaning.providers.permissions import (
            has_publishing_membership,
        )

        return has_publishing_membership(obj)

    def get_provider_accounts(self, obj):
        if not self._vertical_enabled():
            return []
        from verticals.cleaning.providers.permissions import (
            provider_accounts_payload,
        )

        return provider_accounts_payload(obj)
