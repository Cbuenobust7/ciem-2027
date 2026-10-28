from rest_framework import permissions


class IsReviewerOrReadOnly(permissions.BasePermission):
    """Solo el reviewer puede editar/eliminar su reseña."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.reviewer == request.user