from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .auth import EmailTokenObtainPairView
from .views import RegisterView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', EmailTokenObtainPairView.as_view(), name='login'),
    path('refresh/', TokenRefreshView.as_view(), name='refresh'),
]
