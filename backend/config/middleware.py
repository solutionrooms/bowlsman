import logging
import time
import json
from django.http import HttpResponse

logger = logging.getLogger('django.request')

class RequestLoggingMiddleware:
    """
    Middleware to log all HTTP requests and responses
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Log request details
        start_time = time.time()
        path = request.path
        method = request.method
        
        # Log request body for POST/PUT/PATCH requests
        if method in ['POST', 'PUT', 'PATCH'] and request.body:
            try:
                body = json.loads(request.body)
                logger.info(f"API Request: {method} {path} - Body: {json.dumps(body)}")
            except json.JSONDecodeError:
                logger.info(f"API Request: {method} {path} - Body: (non-JSON data)")
        else:
            logger.info(f"API Request: {method} {path}")
        
        # Log query parameters
        if request.GET:
            logger.info(f"Query params: {dict(request.GET.items())}")
        
        # Get the response
        response = self.get_response(request)
        
        # Log response details
        duration = time.time() - start_time
        status_code = response.status_code
        
        # Try to log response content for API calls
        if path.startswith('/api/'):
            try:
                if isinstance(response, HttpResponse) and response.content:
                    try:
                        if '/competitions' in path:
                            # For competition endpoints, log full response data
                            content = json.loads(response.content.decode('utf-8'))
                            logger.info(f"API Response: {method} {path} - {status_code} - {duration:.2f}s - Data: {json.dumps(content)}")
                        else:
                            # For other endpoints, log basic response info
                            content = json.loads(response.content.decode('utf-8'))
                            if isinstance(content, list):
                                logger.info(f"API Response: {method} {path} - {status_code} - {duration:.2f}s - Items: {len(content)}")
                            else:
                                logger.info(f"API Response: {method} {path} - {status_code} - {duration:.2f}s - Data type: {type(content).__name__}")
                    except json.JSONDecodeError:
                        logger.info(f"API Response: {method} {path} - {status_code} - {duration:.2f}s - (non-JSON response)")
            except Exception as e:
                logger.info(f"API Response: {method} {path} - {status_code} - {duration:.2f}s - Error logging content: {str(e)}")
        else:
            logger.info(f"Response: {method} {path} - {status_code} - {duration:.2f}s")
        
        return response