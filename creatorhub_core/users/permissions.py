from rest_framework import permissions


class IsOwner(permissions.BasePermission):
    """Permite solo al dueño del objeto."""
    def has_object_permission(self, request, view, obj):
        return obj.user == request.user


class IsAdmin(permissions.BasePermission):
    """Permite solo a staff."""
    def has_permission(self, request, view):
        return request.user and request.user.is_staff


class IsVerified(permissions.BasePermission):
    """Permite solo a usuarios verificados."""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_verified
