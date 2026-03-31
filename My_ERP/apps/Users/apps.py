from django.apps import AppConfig

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.Users'

    def ready(self):
        import firebase_admin
        from firebase_admin import credentials
        import os

        if not firebase_admin._apps:
            cred = credentials.Certificate(
                os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
            )
            firebase_admin.initialize_app(cred)
