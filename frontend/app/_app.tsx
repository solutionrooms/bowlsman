import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { logPageView } from '../src/utils/analytics';
import type { AppProps } from 'next/app';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    // Log page view on route changes
    const handleRouteChange = () => {
      logPageView();
    };

    // Log initial page view
    logPageView();

    // Set up route change listener
    router.events.on('routeChangeComplete', handleRouteChange);

    // Clean up
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  return <Component {...pageProps} />;
}

export default MyApp; 