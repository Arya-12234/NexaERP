from firebase_admin import auth
from django.contrib.auth.models import User
from django.contrib.auth.backends import BaseBackend

class FirebaseAuthBackend(BaseBackend):
    def authenticate(self, request, firebase_token=None):
        print(">>> FirebaseAuthBackend called")  # debug
        if not firebase_token:
            print(">>> No token received")
            return None
        try:
            decoded_token = auth.verify_id_token(firebase_token)
            print(">>> Token verified:", decoded_token)
        except Exception as e:
            print(">>> Token verification failed:", e)  # <-- this will show the real error
            return None

        uid = decoded_token["uid"]
        email = decoded_token.get("email", "")
        user, _ = User.objects.get_or_create(username=uid, defaults={"email": email})
        return user

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None