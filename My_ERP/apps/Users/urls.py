from django.urls import path
from apps.Users.views import FirebaseLoginAPIView, ProtectedView

urlpatterns = [
    path("firebase-login/", FirebaseLoginAPIView.as_view(), name="firebase-login"),
    path('protected/', ProtectedView.as_view(), name='protected'),  
]