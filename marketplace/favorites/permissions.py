from rest_framework import permissions


class IsFavoriteOwner(permissions.BasePermission):
    """
    Permite modificar o eliminar un favorito únicamente
    a su propietario.
    """

    def has_object_permission(self, request, view, obj):
        return obj.user == request.user