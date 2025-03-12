/**
 * Logs a page view to the backend analytics service
 */
export const logPageView = async () => {
  try {
    const response = await fetch('/api/log/page-view/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: window.location.pathname,
        title: document.title,
        referrer: document.referrer,
        queryParams: Object.fromEntries(new URLSearchParams(window.location.search)),
        timestamp: Date.now(),
      }),
      credentials: 'include',  // Important for sending auth cookies
    });
    
    if (!response.ok) {
      console.warn('Failed to log page view:', response.statusText);
    }
  } catch (error) {
    // Silently fail - we don't want to break the app if analytics fails
    console.warn('Error logging page view:', error);
  }
}; 