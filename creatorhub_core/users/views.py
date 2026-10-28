from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from .auth import get_user_serializer
from .serializers import RegisterSerializer
from .services import get_tokens_for_user


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        tokens = get_tokens_for_user(user)

        user_serializer_class = get_user_serializer()

        return Response({
            'user': user_serializer_class(user).data,
            'tokens': tokens,
        }, status=status.HTTP_201_CREATED)
