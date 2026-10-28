from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from verticals.cleaning.bookings.models import Booking

from .models import Review
from .permissions import IsReviewerOrReadOnly
from .serializers import ReviewSerializer


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.select_related(
        'reviewer', 'seller', 'listing', 'booking'
    )
    serializer_class = ReviewSerializer
    permission_classes = [
        permissions.IsAuthenticatedOrReadOnly,
        IsReviewerOrReadOnly,
    ]

    filter_backends = [
        DjangoFilterBackend,
        filters.OrderingFilter,
    ]

    filterset_fields = ['seller', 'listing', 'rating']
    ordering_fields = ['created_at', 'rating']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        """Una reseña de reserva hereda cliente, vendedor y anuncio de la reserva.

        `is_verified` no se pasa aquí: lo deriva `Review.save()` del estado de la
        reserva, que es la única fuente de verdad (ADR-09).
        """
        booking = serializer.validated_data.get('booking')
        if booking is not None:
            serializer.save(
                reviewer=self.request.user,
                seller=booking.account.owner,
                listing=booking.listing,
            )
            return

        listing = serializer.validated_data['listing']
        serializer.save(
            reviewer=self.request.user,
            seller=listing.seller,
        )

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[permissions.AllowAny],
    )
    def by_seller(self, request):
        seller_id = request.query_params.get('seller_id')

        if not seller_id:
            return Response(
                {'detail': 'seller_id es requerido'},
                status=400,
            )

        reviews = (
            Review.objects
            .filter(seller_id=seller_id)
            .select_related('reviewer', 'listing')
            .order_by('-created_at')
        )

        serializer = ReviewSerializer(
            reviews,
            many=True,
            context={'request': request},
        )

        return Response(serializer.data)
