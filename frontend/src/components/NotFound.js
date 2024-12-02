// frontend/src/components/NotFound.js

import React from 'react';
import { Page, Card } from '@shopify/polaris';

function NotFound() {
  return (
    <Page title="Page Not Found">
      <Card sectioned>
        <p>The page you are looking for does not exist.</p>
      </Card>
    </Page>
  );
}

export default NotFound;
