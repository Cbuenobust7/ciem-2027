from django.urls import path

from . import views

urlpatterns = [
    path('create-preference/', views.CreatePreferenceView.as_view(), name='create-preference'),
    path('webhook/mercadopago/', views.mercadopago_webhook, name='mp-webhook'),
    path('history/', views.PaymentHistoryView.as_view(), name='payment-history'),
]
