from rest_framework import permissions


class IsPurchaseOwner(permissions.BasePermission):
    """Solo el dueño de la compra puede verla."""

    def has_object_permission(self, request, view, obj):
        return obj.seller == request.user