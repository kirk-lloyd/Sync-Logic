// frontend/src/App.js

import React from 'react';
import { AppProvider as PolarisProvider, Page, Card } from '@shopify/polaris';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import createApp from '@shopify/app-bridge';
import { useEffect, useState } from 'react';

function App() {
  const [appBridgeInitialized, setAppBridgeInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState(null);

  useEffect(() => {
    // Extract query parameters from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const shopOrigin = urlParams.get('shop');
    const host = urlParams.get('host');

    console.log('Shop Origin:', shopOrigin);
    console.log('Host (encoded):', host);

    if (!shopOrigin || !host) {
      setInitializationError('Missing "shop" or "host" parameter in URL.');
      console.error('App-Bridge Initialization Error: Missing "shop" or "host" parameter.');
      return;
    }

    const appBridgeConfig = {
      apiKey: process.env.REACT_APP_SHOPIFY_API_KEY,
      host: host, // Use the host value as provided by Shopify, without decoding
      forceRedirect: true,
    };

    console.log("App Bridge Config:", appBridgeConfig);

    try {
      const app = createApp(appBridgeConfig);
      setAppBridgeInitialized(true);
    } catch (error) {
      console.error("App-Bridge Initialization Error:", error);
      setInitializationError(error.message);
    }
  }, []);

  if (initializationError) {
    return (
      <p style={{ color: 'red' }}>Error: {initializationError}</p>
    );
  }

  if (!appBridgeInitialized) {
    return <p>Initializing App Bridge...</p>;
  }

  return (
    <PolarisProvider>
      <Router>
        <Routes>
          <Route path="/" element={
            <Page title="Simple Home Page">
              <Card sectioned>
                <p>This is a simplified test to identify issues.</p>
              </Card>
            </Page>
          } />
        </Routes>
      </Router>
    </PolarisProvider>
  );
}

export default App;
