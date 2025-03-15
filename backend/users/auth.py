from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

UserModel = get_user_model()

class DevelopmentAuthBackend(ModelBackend):
    """
    Authentication backend that allows 'pass' as a valid password for any user
    during development. This should only be used in development environments.
    """
    
    def authenticate(self, request, username=None, password=None, **kwargs):
        if not username or not password:
            return None
            
        # Check if password is 'pass', the development testing password
        if password == 'pass':
            try:
                # Try to get the user
                user = UserModel.objects.get(username=username)
                return user
            except UserModel.DoesNotExist:
                # No such user
                return None
        
        # Otherwise, fall back to the default authentication behavior
        return super().authenticate(request, username=username, password=password, **kwargs) 