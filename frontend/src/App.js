import React from 'react';
import { AppProvider, Page, Card } from '@shopify/polaris';
import Navigation from './components/Navigation';
import AppBridgeProvider from './providers/AppBridgeProvider';

function App() {
  return (
    <AppBridgeProvider>
      <AppProvider>
        <Navigation />
        <Page title="Stock Sync Logic">
          {/* Rest of your app components go here */}
          <Card sectioned>
            <p>Welcome to Stock Sync Logic!</p>
          </Card>
        </Page>
      </AppProvider>
    </AppBridgeProvider>
  );
}

export default App;
