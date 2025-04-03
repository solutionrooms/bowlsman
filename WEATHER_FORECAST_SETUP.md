# Weather Forecast Integration Setup

This document outlines the steps needed to set up the weather forecast integration for events on the noticeboard.

## Overview

The feature adds weather forecasts to social bowling events based on their location and date. Weather information is fetched from the [WeatherAPI.com](https://www.weatherapi.com/) service and displayed both on the noticeboard listing page and the event detail page.

## Setup Steps

### 1. Get a Weather API Key

1. Sign up for a free account at [WeatherAPI.com](https://www.weatherapi.com/)
2. After signing up, obtain your API key from the dashboard
3. The free tier includes 1,000,000 API calls per month which should be more than sufficient

### 2. Configure Environment Variables

Add your API key to the backend environment files:

- For local development: Add to `backend/.env.local`
- For Docker development: Add to `backend/.env.docker`
- For production: Add to your production environment

Add the following line:
```
WEATHER_API_KEY=your-api-key-here
```

### 3. Apply Database Migrations

Run the following command to apply the database migration that adds weather forecast fields:

```bash
# If running locally
cd backend
python manage.py migrate

# If using Docker
docker-compose exec backend python manage.py migrate
```

## How It Works

- Weather data is automatically fetched when a social bowling event is viewed
- Forecasts are cached for 6 hours to minimize API usage
- The weather forecast includes:
  - Weather condition (e.g., "Partly cloudy")
  - Weather icon
  - Temperature range
  - Chance of rain
- Weather data is displayed on both the noticeboard listing and event detail pages

## Limitations

- Weather forecasts are only available for dates up to 14 days in the future
- Accuracy depends on the location specificity - more precise locations will yield better results
- The system requires a valid API key to function

## Troubleshooting

If weather forecasts are not appearing:

1. Check that your API key is correctly configured in the environment variables
2. Verify that the location field contains a recognizable location name or address
3. Ensure the date is in the future and within the 14-day forecast window
4. Check the backend logs for any API errors or rate limiting issues