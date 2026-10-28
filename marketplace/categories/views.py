from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Category
from .serializers import CategorySerializer, CategoryTreeSerializer
from .permissions import IsAdminOrReadOnly


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.select_related('parent').filter(is_active=True)
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAdminOrReadOnly]
    filterset_fields = ['parent', 'is_active']
    search_fields = ['name']
    ordering_fields = ['order', 'name', 'created_at']
    ordering = ['order', 'name']

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.is_staff:
            # Staff puede ver inactivas también
            queryset = Category.objects.select_related('parent').all()
        return queryset

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def tree(self, request):
        """Devuelve el árbol de categorías raíz (con hijos anidados)."""
        roots = Category.objects.filter(
            parent__isnull=True,
            is_active=True
        ).order_by('order', 'name')
        serializer = CategoryTreeSerializer(roots, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def roots(self, request):
        """Devuelve solo las categorías raíz (sin hijos)."""
        roots = Category.objects.filter(
            parent__isnull=True,
            is_active=True
        ).order_by('order', 'name')
        serializer = CategorySerializer(roots, many=True, context={'request': request})
        return Response(serializer.data)