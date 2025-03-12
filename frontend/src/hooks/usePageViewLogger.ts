import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { logPageView } from '../utils/analytics';

/**
 * Hook to automatically log page views when the route changes
 */
export const usePageViewLogger = () => {
  const location = useLocation();

  useEffect(() => {
    // Log the page view whenever the location changes
    logPageView();
  }, [location]); // Re-run when the location changes
}; 