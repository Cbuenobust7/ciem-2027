from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models, transaction

from rest_framework import viewsets, permissions, status, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from .models import Listing, ListingImage
from verticals.cleaning.services.models import ServiceDetails
from .serializers import ListingListSerializer, ListingDetailSerializer, ListingImageSerializer
from .permissions import CanPublishListing, IsOwnerOrReadOnly, IsListingImageOwner


class ListingViewSet(viewsets.ModelViewSet):
    queryset = (
        Listing.objects
        .select_related("seller")
        .prefetch_related("images")
    )

    permission_classes = [
        permissions.IsAuthenticatedOrReadOnly,
        CanPublishListing,
        IsOwnerOrReadOnly,
    ]

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    filterset_fields = [
        "category",
        "condition",
        "status",
        "location",
        "currency",
    ]

    search_fields = [
        "title",
        "description",
    ]

    ordering_fields = [
        "created_at",
        "price",
        "view_count",
    ]

    ordering = ["-created_at"]

    def get_permissions(self):
        result = super().get_permissions()
        if getattr(settings, 'CIEM_CATALOG_ONLY', False):
            if (self.request.method not in permissions.SAFE_METHODS and self.action != 'favorite') or self.action == 'my_listings':
                result.append(permissions.IsAdminUser())
        return result

    def get_serializer_class(self):
        if self.action == "list":
            return ListingListSerializer

        return ListingDetailSerializer

    def get_queryset(self):
        """
        - list: solo 'active' para no-staff.
        - retrieve/update/destroy: propietario o staff pueden ver cualquier
          estado; el resto solo 'active'.
        """
        queryset = super().get_queryset()
        user = self.request.user
        if getattr(settings, 'CIEM_CATALOG_ONLY', False) and not (user.is_authenticated and user.is_staff):
            queryset = queryset.filter(seller__username=settings.CIEM_CATALOG_OWNER)

        # Staff ve todo siempre
        if user and user.is_authenticated and user.is_staff:
            return queryset

        if self.action == "list":
            return queryset.filter(status="active")

        if self.action in ("retrieve", "update", "partial_update", "destroy"):
            if user and user.is_authenticated:
                return queryset.filter(
                    models.Q(status="active") | models.Q(seller=user)
                )
            return queryset.filter(status="active")

        # Otras acciones (publish, mark_as_sold, favorite, my_listings)
        # validan permisos por su cuenta.
        return queryset

    def perform_create(self, serializer):
        # Todo anuncio nace en 'draft'. Pasa a 'active' solo vía publish().
        owner = self.request.user
        if getattr(settings, 'CIEM_CATALOG_ONLY', False):
            owner = get_user_model().objects.get(username=settings.CIEM_CATALOG_OWNER)
        serializer.save(seller=owner, status='draft')

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated],
    )
    def publish(self, request, pk=None):
        listing = self.get_object()

        if (
            listing.seller != request.user
            and not request.user.is_staff
        ):
            return Response(
                {"detail": "No autorizado"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if ServiceDetails.objects.filter(listing=listing).exists():
            if not request.user.is_staff:
                return Response({'detail': 'Envía el servicio a revisión; solo la plataforma puede aprobarlo.'}, status=status.HTTP_403_FORBIDDEN)
            listing.approve(request.user)
        else:
            listing.publish()

        return Response(
            ListingDetailSerializer(
                listing,
                context={"request": request},
            ).data
        )

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[permissions.IsAuthenticated],
        url_path='submit-review',
    )
    def submit_review(self, request, pk=None):
        listing = self.get_object()
        if not ServiceDetails.objects.filter(listing=listing).exists():
            return Response({'detail': 'Solo los servicios de limpieza se moderan.'}, status=status.HTTP_400_BAD_REQUEST)
        if listing.seller_id != request.user.id and not request.user.is_staff:
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            listing.submit_for_review()
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(ListingDetailSerializer(listing, context={'request': request}).data)


    @action(
        detail=True,
        methods=['post'],
        permission_classes=[permissions.IsAuthenticated],
    )
    def mark_as_sold(self, request, pk=None):
        listing = self.get_object()

        if (
            listing.seller != request.user
            and not request.user.is_staff
        ):
            return Response(
                {"detail": "No autorizado"},
                status=status.HTTP_403_FORBIDDEN,
            )

        listing.mark_as_sold()

        return Response(
            ListingDetailSerializer(
                listing,
                context={"request": request},
            ).data
        )

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[permissions.IsAuthenticated],
    )
    def my_listings(self, request):
        listings = (
            Listing.objects
            .filter(seller=request.user)
            .order_by("-created_at")
        )

        if getattr(settings, 'CIEM_CATALOG_ONLY', False):
            listings = Listing.objects.filter(seller__username=settings.CIEM_CATALOG_OWNER).order_by('-created_at')

        serializer = ListingListSerializer(
            listings,
            many=True,
            context={"request": request},
        )

        return Response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated],
    )
    def favorite(self, request, pk=None):
        from marketplace.favorites.models import Favorite

        listing = self.get_object()

        favorite = Favorite.objects.filter(
            user=request.user,
            listing=listing,
        ).first()

        if favorite:
            favorite.delete()

            return Response({
                "status": "unfavorited",
                "favorite_count": listing.favorites.count(),
            })

        Favorite.objects.create(
            user=request.user,
            listing=listing,
        )

        return Response({
            "status": "favorited",
            "favorite_count": listing.favorites.count(),
        })


# ============================================================
# Listing Images
# ============================================================

MAX_IMAGES_PER_LISTING = 10
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp'}


class ListingImageViewSet(viewsets.ModelViewSet):
    """
    Gestión de imágenes de un listing.

    POST   /api/listing-images/
    DELETE /api/listing-images/{id}/
    POST   /api/listing-images/{id}/set_cover/
    """

    queryset = ListingImage.objects.select_related(
        'listing',
        'listing__seller',
    )
    serializer_class = ListingImageSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        IsListingImageOwner,
    ]
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        result = super().get_permissions()
        if getattr(settings, 'CIEM_CATALOG_ONLY', False) and self.request.method not in permissions.SAFE_METHODS:
            result.append(permissions.IsAdminUser())
        return result

    def get_queryset(self):
        queryset = super().get_queryset()

        listing_id = self.request.query_params.get('listing')
        if listing_id:
            queryset = queryset.filter(listing_id=listing_id)

        return queryset

    def create(self, request, *args, **kwargs):
        listing_id = request.data.get('listing')

        if not listing_id:
            return Response(
                {'detail': 'Falta el campo "listing".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            listing = Listing.objects.get(pk=listing_id)
        except Listing.DoesNotExist:
            return Response(
                {'detail': 'Listing no encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if listing.seller_id != request.user.id and not request.user.is_staff:
            return Response(
                {'detail': 'No autorizado.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if listing.images.count() >= MAX_IMAGES_PER_LISTING:
            return Response(
                {
                    'detail': (
                        f'Máximo {MAX_IMAGES_PER_LISTING} '
                        'imágenes por anuncio.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        image_file = request.FILES.get('image')

        if not image_file:
            return Response(
                {'detail': 'Falta el archivo "image".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content_type = getattr(image_file, 'content_type', None)

        if content_type not in ALLOWED_IMAGE_TYPES:
            return Response(
                {
                    'detail': (
                        f'Tipo no permitido: {content_type}. '
                        'Usa JPEG, PNG o WebP.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if image_file.size > MAX_IMAGE_SIZE_BYTES:
            return Response(
                {
                    'detail': (
                        'Imagen demasiado grande '
                        f'(máx {MAX_IMAGE_SIZE_BYTES // (1024 * 1024)} MB).'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            is_first = not listing.images.exists()

            next_order = (
                listing.images
                .order_by('-order')
                .values_list('order', flat=True)
                .first()
                or 0
            ) + 1

            image = ListingImage.objects.create(
                listing=listing,
                image=image_file,
                alt_text=request.data.get('alt_text', ''),
                order=next_order,
                is_cover=is_first,
            )

        serializer = self.get_serializer(
            image,
            context={'request': request},
        )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        image = self.get_object()

        with transaction.atomic():
            was_cover = image.is_cover
            listing = image.listing

            image.delete()

            if was_cover:
                next_image = (
                    listing.images
                    .order_by('order', 'created_at')
                    .first()
                )

                if next_image:
                    next_image.is_cover = True
                    next_image.save(update_fields=['is_cover'])

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True,
        methods=['post'],
        url_path='set_cover',
    )
    def set_cover(self, request, pk=None):
        image = self.get_object()
        listing = image.listing

        with transaction.atomic():
            listing.images.filter(is_cover=True).update(is_cover=False)

            image.is_cover = True
            image.save(update_fields=['is_cover'])

        serializer = self.get_serializer(
            image,
            context={'request': request},
        )

        return Response(serializer.data)