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
        if method in ['POST', 'PUT', 'PATCH'] and hasattr(request, 'body'):
            # Check if the content type is multipart/form-data or not JSON
            content_type = request.META.get('CONTENT_TYPE', '')
            if 'multipart/form-data' in content_type:
                # For multipart/form-data, log file names if available
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
        
        # Get the response
        response = self.get_response(request)
        
        # Log response details
        duration = time.time() - start_time
        status_code = response.status_code
        
        # Try to log response content for API calls
        if path.startswith('/api/'):
            try:
                # Check if the content is JSON before trying to parse it
                content_type = response.get('Content-Type', '')
                if 'application/json' in content_type and isinstance(response, HttpResponse) and hasattr(response, 'content'):
                    try:
                        content = json.loads(response.content.decode('utf-8'))
                        if '/competitions' in path:
                            # For competition endpoints, log full response data
                            logger.info(f"API Response: {method} {path} - {status_code} - {duration:.2f}s - Data: {json.dumps(content)}")
                        else:
                            # For other endpoints, log basic response info
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