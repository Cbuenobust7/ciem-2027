"""Rutas de Cleaning, montadas solo si el feature flag está activo."""

from django.urls import path

from verticals.cleaning.availability.views import ProviderAvailabilityView
from verticals.cleaning.bookings.views import (
    BookingActionView,
    BookingDetailView,
    BookingListCreateView,
    ProviderBookingsView,
)
from verticals.cleaning.providers.views import (
    ProviderAdminAuditView,
    ProviderAdminClaimActionView,
    ProviderAdminClaimListView,
    ProviderAdminCorrectionActionView,
    ProviderAdminCorrectionListView,
    ProviderAdminProviderListView,
    ProviderAdminPublishView,
    ProviderClaimView,
    ProviderCorrectionView,
    ProviderDetailView,
    ProviderListCreateView,
    ProviderMembersView,
    ProviderResourceListCreateView,
    ProviderServiceAreaDeleteView,
    ProviderServiceAreaListCreateView,
    ProviderRequestVerificationView,
    ProviderServicesView,
    ProviderManagedServicesView,
    ResourceScheduleView,
)
from verticals.cleaning.services.views import (
    CleaningServiceCreateView,
    CleaningServiceDetailView,
)

urlpatterns = [
    path('providers/', ProviderListCreateView.as_view(), name='cleaning-provider-list'),
    path('providers/<int:pk>/', ProviderDetailView.as_view(), name='cleaning-provider-detail'),
    path(
        'providers/<int:pk>/request-verification/',
        ProviderRequestVerificationView.as_view(),
        name='cleaning-provider-request-verification',
    ),
    path('providers/<int:pk>/services/', ProviderServicesView.as_view(), name='cleaning-provider-services'),
    path('providers/<int:pk>/services/manage/', ProviderManagedServicesView.as_view(), name='cleaning-provider-services-manage'),
    path(
        'providers/<int:pk>/availability/',
        ProviderAvailabilityView.as_view(),
        name='cleaning-provider-availability',
    ),
    path(
        'providers/<int:pk>/bookings/',
        ProviderBookingsView.as_view(),
        name='cleaning-provider-bookings',
    ),
    path(
        'providers/<int:pk>/resources/',
        ProviderResourceListCreateView.as_view(),
        name='cleaning-provider-resources',
    ),
    path(
        'providers/<int:pk>/resources/<int:rid>/schedule/',
        ResourceScheduleView.as_view(),
        name='cleaning-provider-schedule',
    ),
    path(
        'providers/<int:pk>/members/',
        ProviderMembersView.as_view(),
        name='cleaning-provider-members',
    ),
    path('providers/<int:pk>/service-areas/', ProviderServiceAreaListCreateView.as_view(), name='cleaning-provider-areas'),
    path('providers/<int:pk>/service-areas/<int:area_id>/', ProviderServiceAreaDeleteView.as_view(), name='cleaning-provider-area-delete'),
    path(
        'providers/<int:pk>/claim/',
        ProviderClaimView.as_view(),
        name='cleaning-provider-claim',
    ),
    path(
        'providers/<int:pk>/corrections/',
        ProviderCorrectionView.as_view(),
        name='cleaning-provider-correction',
    ),
    # Administración: bandejas y acciones auditadas (§5, §8).
    path(
        'admin/providers/',
        ProviderAdminProviderListView.as_view(),
        name='cleaning-admin-provider-list',
    ),
    path(
        'admin/providers/<int:pk>/publish/',
        ProviderAdminPublishView.as_view(),
        name='cleaning-admin-provider-publish',
    ),
    path(
        'admin/claims/',
        ProviderAdminClaimListView.as_view(),
        name='cleaning-admin-claim-list',
    ),
    path(
        'admin/claims/<int:pk>/<str:action>/',
        ProviderAdminClaimActionView.as_view(),
        name='cleaning-admin-claim-action',
    ),
    path(
        'admin/corrections/',
        ProviderAdminCorrectionListView.as_view(),
        name='cleaning-admin-correction-list',
    ),
    path(
        'admin/corrections/<int:pk>/<str:action>/',
        ProviderAdminCorrectionActionView.as_view(),
        name='cleaning-admin-correction-action',
    ),
    path(
        'admin/audit/',
        ProviderAdminAuditView.as_view(),
        name='cleaning-admin-audit',
    ),
    path('services/', CleaningServiceCreateView.as_view(), name='cleaning-service-create'),
    path('services/<int:listing_id>/', CleaningServiceDetailView.as_view(), name='cleaning-service-detail'),
    path('bookings/', BookingListCreateView.as_view(), name='cleaning-booking-list'),
    path('bookings/<str:code>/', BookingDetailView.as_view(), name='cleaning-booking-detail'),
    path(
        'bookings/<str:code>/<str:action>/',
        BookingActionView.as_view(),
        name='cleaning-booking-action',
    ),
]
