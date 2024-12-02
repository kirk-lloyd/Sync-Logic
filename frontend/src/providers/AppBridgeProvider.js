import React, { useEffect, useState } from 'react';
import createApp from '@shopify/app-bridge';

const AppBridgeProvider = ({ children }) => {
  const [app, setApp] = useState(null);

  useEffect(() => {
    const host = new URLSearchParams(window.location.search).get('host');
    if (!host) {
      console.error("Host parameter missing in the URL");
      return;
    }

    // App setup using App Bridge
    const app = createApp({
      apiKey: process.env.REACT_APP_SHOPIFY_API_KEY,
      host: host,
      forceRedirect: true,
    });

    setApp(app);
    console.log('App Bridge initialized successfully.');
  }, []);

  if (!app) {
    return <div>Loading...</div>;
  }

  return (
    <React.Fragment>
      {children}
    </React.Fragment>
  );
};

export default AppBridgeProvider;
