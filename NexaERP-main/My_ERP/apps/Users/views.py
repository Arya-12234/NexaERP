from django.shortcuts import render

# Create your views here.
from django.shortcuts import render

# Create your views here.
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken

class FirebaseLoginAPIView(APIView):
    def post(self, request):
        firebase_token = request.data.get("firebase_token")
        if not firebase_token:
            return Response({"error": "Firebase token is required"}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, firebase_token=firebase_token)
        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "email": user.email
            })
        else:
            return Response({"error": "Invalid Firebase token"}, status=status.HTTP_401_UNAUTHORIZED)
        
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class ProtectedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "message": "You are authenticated",
            "user": request.user.email
        })