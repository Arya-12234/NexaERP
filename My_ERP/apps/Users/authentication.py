from django.contrib.auth.backends import BaseBackend
from django.contrib.auth import get_user_model
from firebase_admin import auth as firebase_auth

User = get_user_model()

class FirebaseTokenBackend(BaseBackend):
    """
    Authenticate using Firebase ID tokens.
    """

    def authenticate(self, request, firebase_token=None):
        if not firebase_token:
            return None

        try:
            decoded_token = firebase_auth.verify_id_token(firebase_token)
            email = decoded_token.get("email")

            if not email:
                return None

            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "is_active": True
                }
            )

            return user

        except Exception as e:
            print(f"Firebase authentication failed: {e}")
            return None

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None