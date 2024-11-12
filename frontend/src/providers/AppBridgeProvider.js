import React, { useEffect } from 'react';
import { AppProvider } from '@shopify/polaris';
import createApp from '@shopify/app-bridge';
import { onCLS, onFID, onLCP } from 'web-vitals'; // Ensure the functions are correct and available.

function initializeWebVitals() {
  // Initialize web vitals metrics and add logging for each
  onCLS(metric => {
    console.log('Cumulative Layout Shift (CLS):', metric.value);
  });
  
  onFID(metric => {
    console.log('First Input Delay (FID):', metric.value);
  });
  
  onLCP(metric => {
    console.log('Largest Contentful Paint (LCP):', metric.value);
  });
}

function AppBridgeProvider({ children }) {
  useEffect(() => {
    const host = new URLSearchParams(window.location.search).get('host');
    const apiKey = process.env.REACT_APP_SHOPIFY_API_KEY;

    if (!host || !apiKey) {
      console.error('Missing host or apiKey for App Bridge initialization.');
      return;
    }

    const app = createApp({
      apiKey,
      host,
      forceRedirect: true,
    });

    if (!app) {
      console.error('App Bridge failed to initialize. Check your configuration.');
    } else {
      console.log('App Bridge initialized successfully.');
      initializeWebVitals(); // Set up web vitals once the App Bridge has been created.
    }
  }, []);

  return (
    <AppProvider>
      {children}
    </AppProvider>
  );
}

export default AppBridgeProvider;
