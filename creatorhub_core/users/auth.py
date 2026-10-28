from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.module_loading import import_string
from rest_framework import exceptions, serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

User = get_user_model()


def get_user_serializer():
    """
    Devuelve el serializer de usuario configurado en settings.

    Cada producto define su propio USER_SERIALIZER, que extiende
    el UserSerializer del Core con campos específicos.
    """
    path = getattr(
        settings,
        'USER_SERIALIZER',
        'creatorhub_core.users.serializers.UserSerializer',
    )
    return import_string(path)


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Permite login mediante email en lugar de username.

    Redefine los campos del serializer padre para eliminar 'username'
    (que SimpleJWT añade por defecto en su __init__) y aceptar 'email'.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Eliminar el campo 'username' heredado del padre.
        # Es necesario porque TokenObtainPairSerializer lo añade
        # dinámicamente en su __init__, y DRF lo valida ANTES de
        # llamar a validate(), lo que provocaría
        # "username: Este campo es requerido."
        self.fields.pop('username', None)

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if not email or not password:
            raise exceptions.AuthenticationFailed(
                'Email y contraseña son requeridos.'
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise exceptions.AuthenticationFailed(
                'Credenciales inválidas.'
            )

        if not user.check_password(password):
            raise exceptions.AuthenticationFailed(
                'Credenciales inválidas.'
            )

        if not user.is_active:
            raise exceptions.AuthenticationFailed(
                'Usuario inactivo.'
            )

        refresh = self.get_token(user)

        # Serializer configurable por producto vía settings.
        # El Core no conoce marketplace; solo lee settings.USER_SERIALIZER.
        user_serializer_class = get_user_serializer()

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': user_serializer_class(user).data,
        }

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Añadir claims personalizados al JWT
        token['email'] = user.email
        token['username'] = user.username
        token['is_verified'] = user.is_verified
        return token


class EmailTokenObtainPairView(TokenObtainPairView):
    """
    Vista de login que acepta email + password.
    """
    serializer_class = EmailTokenObtainPairSerializer
