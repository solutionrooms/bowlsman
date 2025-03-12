from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.utils.timezone import now
from .models import ApiLog
from datetime import datetime
import pytz

@api_view(['POST'])
@permission_classes([AllowAny])
def log_page_view(request):
    """
    Endpoint to log frontend page views
    """
    try:
        # Get frontend timestamp and convert to datetime
        frontend_ts = request.data.get('timestamp')
        if frontend_ts:
            try:
                frontend_timestamp = datetime.fromtimestamp(frontend_ts / 1000.0, tz=pytz.UTC)
            except (ValueError, TypeError):
                frontend_timestamp = None
        else:
            frontend_timestamp = None

        # Create log entry
        ApiLog.objects.create(
            user=request.user if request.user.is_authenticated else None,
            method='GET',  # Page views are essentially GET requests
            path=request.data.get('path', ''),
            page_title=request.data.get('title'),
            referrer=request.data.get('referrer'),
            query_params=request.data.get('queryParams'),
            status_code=200,  # Assuming successful page load
            response_time=0.0,  # Not applicable for page views
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT'),
            log_type='page',
            frontend_timestamp=frontend_timestamp,
            timestamp=now()
        )
        return Response({'status': 'success'})
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        ) 