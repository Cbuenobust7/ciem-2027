from django.urls import path

from . import views

urlpatterns = [
    path(
        "cities/",
        views.CityListView.as_view(),
        name="city-list",
    ),
    path(
        "cities/<slug:slug>/availability/",
        views.CityAvailabilityView.as_view(),
        name="city-availability",
    ),
    path(
        "cities/<slug:slug>/claim/",
        views.ClaimFreeSlotView.as_view(),
        name="claim-free-slot",
    ),
    path(
        "cities/<slug:slug>/buy/",
        views.BuySlotView.as_view(),
        name="buy-slot",
    ),
    path(
        "me/",
        views.MyVisibilityPurchasesView.as_view(),
        name="my-visibility-purchases",
    ),
    path(
        "cities/<slug:slug>/process/",
        views.ProcessSlotPaymentView.as_view(),
        name="process-slot-payment",
    ),
    path(
        "featured/",
        views.FeaturedSellersView.as_view(),
        name="featured-sellers",
    ),
]