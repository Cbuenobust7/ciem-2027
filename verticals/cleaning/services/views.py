from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from verticals.cleaning.errors import ProviderNotOperational
from verticals.cleaning.providers.permissions import can_manage_provider
from verticals.cleaning.providers.models import ProviderAccount

from .models import ServiceDetails
from .serializers import CleaningServiceReadSerializer, CleaningServiceSerializer


class CleaningServiceCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CleaningServiceSerializer

    def create(self, request, *args, **kwargs):
        account_id = request.data.get('provider_account')
        if account_id:
            account = get_object_or_404(ProviderAccount, pk=account_id)
            if not can_manage_provider(request.user, account):
                return Response({'detail': 'forbidden_role'}, status=status.HTTP_403_FORBIDDEN)
            if not account.can_operate:
                raise ProviderNotOperational(
                    'Esta ficha no tiene operativa habilitada.',
                    extra={'account': account.id},
                )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = serializer.save()
        return Response(
            CleaningServiceReadSerializer(service, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class CleaningServiceDetailView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CleaningServiceSerializer
    lookup_url_kwarg = 'listing_id'

    def get_queryset(self):
        return ServiceDetails.objects.select_related('listing', 'provider_account')

    def get_object(self):
        listing_id = self.kwargs[self.lookup_url_kwarg]
        return get_object_or_404(self.get_queryset(), listing_id=listing_id)

    def patch(self, request, *args, **kwargs):
        service = self.get_object()
        if not can_manage_provider(request.user, service.provider_account):
            return Response({'detail': 'forbidden_role'}, status=status.HTTP_403_FORBIDDEN)
        if not service.provider_account.can_operate:
            raise ProviderNotOperational(
                'Esta ficha no tiene operativa habilitada.',
                extra={'account': service.provider_account_id},
            )
        serializer = self.get_serializer(service, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        service = serializer.save()
        return Response(CleaningServiceReadSerializer(service, context={'request': request}).data)
