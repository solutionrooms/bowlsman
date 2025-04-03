import requests
import os
from django.conf import settings
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

def get_weather_forecast(location, event_date):
    """
    Fetch a weather forecast for a location and future date.
    
    Args:
        location (str): The location name/address for the event
        event_date (date): The date of the event to get forecast for
        
    Returns:
        dict: Weather forecast data or None if not available
    """
    # Get API key from settings or environment
    api_key = getattr(settings, 'WEATHER_API_KEY', os.environ.get('WEATHER_API_KEY'))
    
    if not api_key:
        logger.warning("No WEATHER_API_KEY found in settings or environment")
        return None
        
    # Calculate days from now to the event (needed for API)
    today = timezone.now().date()
    days_from_now = (event_date - today).days
    
    # Most free weather APIs have limited forecast days (typically 7-14 days)
    if days_from_now < 0:
        # Event is in the past
        return None
    elif days_from_now > 14:
        # Event is too far in the future for accurate forecasting
        return {
            'condition': 'Forecast not available yet',
            'icon': None,
            'temp': None,
            'available_date': today + timezone.timedelta(days=14)
        }
        
    try:
        # Using weatherapi.com format (you'll need to register for a free API key)
        url = f"https://api.weatherapi.com/v1/forecast.json"
        params = {
            'key': api_key,
            'q': location,
            'days': min(days_from_now + 1, 14),  # API typically allows up to 14 days
            'aqi': 'no',  # Air quality data not needed
        }
        
        response = requests.get(url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            
            # Find the forecast for the event date
            target_date_str = event_date.strftime('%Y-%m-%d')
            for day in data['forecast']['forecastday']:
                if day['date'] == target_date_str:
                    return {
                        'condition': day['day']['condition']['text'],
                        'icon': day['day']['condition']['icon'],
                        'max_temp': day['day']['maxtemp_c'],
                        'min_temp': day['day']['mintemp_c'],
                        'avg_temp': day['day']['avgtemp_c'],
                        'chance_of_rain': day['day']['daily_chance_of_rain'],
                        'forecast_text': f"{day['day']['condition']['text']}, {day['day']['avgtemp_c']}°C"
                    }
            
            return None
        elif response.status_code == 400:
            # Bad request could mean invalid location
            logger.warning(f"Weather API returned 400 for location: {location}")
            return None
        else:
            logger.error(f"Weather API returned {response.status_code}: {response.text}")
            return None
            
    except Exception as e:
        logger.exception(f"Error fetching weather data: {str(e)}")
        return None