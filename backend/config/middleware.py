import logging
import time
import json
from django.http import HttpResponse
from .models import ApiLog

logger = logging.getLogger('django.request')

class RequestLoggingMiddleware:
    """
    Middleware to log all HTTP requests and responses and store API calls in database
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Log request details
        start_time = time.time()
        path = request.path
        method = request.method
        
        # Process the request and get response
        response = self.get_response(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log API calls to database if path starts with /api/
        if path.startswith('/api/'):
            try:
                # Prepare request body
                request_body = None
                if method in ['POST', 'PUT', 'PATCH'] and hasattr(request, 'body'):
                    content_type = request.META.get('CONTENT_TYPE', '')
                    if 'application/json' in content_type:
                        try:
                            request_body = json.loads(request.body)
                        except json.JSONDecodeError:
                            request_body = {'error': 'Invalid JSON data'}
                    elif 'multipart/form-data' in content_type:
                        request_body = {'files': [f.name for f in request.FILES.values()]} if request.FILES else None
                
                # Create API log entry
                ApiLog.objects.create(
                    user=request.user if request.user.is_authenticated else None,
                    method=method,
                    path=path,
                    query_params=dict(request.GET.items()) if request.GET else None,
                    request_body=request_body,
                    status_code=response.status_code,
                    response_time=duration,
                    ip_address=request.META.get('REMOTE_ADDR'),
                    user_agent=request.META.get('HTTP_USER_AGENT')
                )
            except Exception as e:
                logger.error(f"Failed to create API log entry: {str(e)}")
        
        # Continue with existing logging
        if method in ['POST', 'PUT', 'PATCH'] and hasattr(request, 'body'):
            content_type = request.META.get('CONTENT_TYPE', '')
            if 'multipart/form-data' in content_type:
                if hasattr(request, 'FILES') and request.FILES:
                    file_info = ", ".join([f"{name}: {f.name} ({f.size} bytes)" for name, f in request.FILES.items()])
                    logger.info(f"API Request: {method} {path} - Multipart form with files: {file_info}")
                else:
                    logger.info(f"API Request: {method} {path} - Multipart form data")
            elif 'application/json' in content_type:
                try:
                    body = json.loads(request.body)
                    logger.info(f"API Request: {method} {path} - Body: {json.dumps(body)}")
                except json.JSONDecodeError:
                    logger.info(f"API Request: {method} {path} - Body: (invalid JSON data)")
                except Exception as e:
                    logger.info(f"API Request: {method} {path} - Error parsing body: {str(e)}")
            else:
                logger.info(f"API Request: {method} {path} - Body: (non-JSON data)")
        else:
            logger.info(f"API Request: {method} {path}")
        
        # Log query parameters
        if request.GET:
            logger.info(f"Query params: {dict(request.GET.items())}")
        
        # Log response details
        status_code = response.status_code
        
        # Try to log response content for API calls
        if path.startswith('/api/'):
            try:
                content_type = response.get('Content-Type', '')
                if 'application/json' in content_type and isinstance(response, HttpResponse) and hasattr(response, 'content'):
                    try:
                        content = json.loads(response.content.decode('utf-8'))
                        if '/competitions' in path:
                            logger.info(f"API Response: {method} {path} - {status_code} - {duration:.2f}s - Data: {json.dumps(content)}")
                        else:
                            if isinstance(content, list):
                                logger.info(f"API Response: {method} {path} - {status_code} - {duration:.2f}s - Items: {len(content)}")
                            else:
                                logger.info(f"API Response: {method} {path} - {status_code} - {duration:.2f}s - Data type: {type(content).__name__}")
                    except json.JSONDecodeError:
                        logger.info(f"API Response: {method} {path} - {status_code} - {duration:.2f}s - (non-JSON response)")
                    except Exception as e:
                        logger.info(f"API Response: {method} {path} - {status_code} - {duration:.2f}s - Error parsing response: {str(e)}")
                else:
                    logger.info(f"API Response: {method} {path} - {status_code} - {duration:.2f}s - (non-JSON content)")
            except Exception as e:
                logger.info(f"API Response: {method} {path} - {status_code} - {duration:.2f}s - Error logging content: {str(e)}")
        else:
            logger.info(f"Response: {method} {path} - {status_code} - {duration:.2f}s")
        
        return response


class LogBodyMiddleware:
    """
    Middleware to log request and response bodies for debugging
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Process the request
        response = self.get_response(request)
        return response