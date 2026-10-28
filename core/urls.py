from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter

from marketplace.users.views import ProfileView
from marketplace.listings.views import ListingImageViewSet


image_router = DefaultRouter()
image_router.register(r'listing-images', ListingImageViewSet, basename='listing-image')


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('creatorhub_core.users.urls')),
    path('api/auth/profile/', ProfileView.as_view(), name='profile'),
    path('api/categories/', include('marketplace.categories.urls')),
    path('api/listings/', include('marketplace.listings.urls')),
    path('api/favorites/', include('marketplace.favorites.urls')),
    path('api/reviews/', include('marketplace.reviews.urls')),
    path('api/payments/', include('creatorhub_core.payments_core.urls')),
    path('api/visibility/', include('marketplace.visibility.urls')),
    path('api/', include(image_router.urls)),
]

# La vertical puede estar instalada para migraciones mientras sus endpoints
# permanecen ocultos. Su URLConf se montará aquí al habilitarla.
if settings.CLEANING_VERTICAL_ENABLED and not settings.CIEM_CATALOG_ONLY:
    urlpatterns.append(path('api/cleaning/', include('verticals.cleaning.urls')))

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
