from django.conf import settings
from rest_framework import permissions


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Lectura pública solo si el objeto es visible (active o el usuario
    es el propietario/staff). Escritura solo para el propietario/staff.
    """

    def has_object_permission(self, request, view, obj):
        user = request.user

        # Staff: acceso total
        if user and user.is_authenticated and user.is_staff:
            return True

        # Propietario: acceso total a su propio objeto
        if user and user.is_authenticated and obj.seller_id == user.id:
            return True

        # No propietario: solo lectura, y solo si está activo
        if request.method in permissions.SAFE_METHODS:
            return obj.status == "active"

        return False


class CanPublishListing(permissions.BasePermission):
    """
    Publicar un anuncio exige ser proveedor cuando la vertical está activa.

    Publican `owner`/`admin` de una cuenta; el `staff` no (§6.1). Con
    `CLEANING_VERTICAL_ENABLED=False` se conserva el comportamiento del paquete
    base —cualquier usuario autenticado publica—, para no romper a quien use el
    marketplace sin la vertical (ADR-10).
    """

    message = 'Solo las cuentas de proveedor pueden publicar servicios.'

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff:
            return True
        if not getattr(settings, 'CLEANING_VERTICAL_ENABLED', False):
            return True

        # Import diferido: sin la vertical, el núcleo no la importa siquiera.
        from verticals.cleaning.providers.permissions import (
            has_publishing_membership,
        )

        return has_publishing_membership(user)


class IsListingImageOwner(permissions.BasePermission):
    """
    Solo el propietario del listing (o staff) puede modificar/borrar
    imágenes. Lectura pública permitida si el listing está activo.
    """

    def has_object_permission(self, request, view, obj):
        user = request.user
        listing = obj.listing

        if user and user.is_authenticated and user.is_staff:
            return True

        if user and user.is_authenticated and listing.seller_id == user.id:
            return True

        if request.method in permissions.SAFE_METHODS:
            return listing.status == "active"

        return False
