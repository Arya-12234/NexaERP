import os

from django.apps import AppConfig


def _resolve_firebase_credentials_path():
    """Return the Firebase service-account path when credentials are configured."""
    explicit = os.getenv('FIREBASE_CREDENTIALS_PATH')
    if explicit and os.path.isfile(explicit):
        return explicit

    default = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
    if os.path.isfile(default):
        return default

    return None


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.Users'

    def ready(self):
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:
            return

        cred_path = _resolve_firebase_credentials_path()
        if not cred_path:
            return

        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
