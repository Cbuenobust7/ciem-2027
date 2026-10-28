from django.contrib.auth import get_user_model
from django.db import IntegrityError
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


def register_user(email: str, username: str, password: str):
    """Registra un usuario nuevo. Lanza ValueError si el email ya existe."""
    if User.objects.filter(email=email).exists():
        raise ValueError('Email ya registrado')

    if User.objects.filter(username=username).exists():
        raise ValueError('Username ya registrado')

    try:
        user = User.objects.create_user(
            email=email,
            username=username,
            password=password,
        )
    except IntegrityError:
        raise ValueError('Email o username ya registrado')

    return user


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }