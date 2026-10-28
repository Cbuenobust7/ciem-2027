from rest_framework import permissions, viewsets

from .models import Favorite
from .permissions import IsFavoriteOwner
from .serializers import FavoriteSerializer


class FavoriteViewSet(viewsets.ModelViewSet):
    serializer_class = FavoriteSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        IsFavoriteOwner,
    ]
    http_method_names = [
        "get",
        "post",
        "delete",
        "head",
        "options",
    ]

    def get_queryset(self):
        return (
            Favorite.objects
            .filter(user=self.request.user)
            .select_related("listing", "listing__seller")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)