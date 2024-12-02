import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import axios from 'axios';
import fetch from 'node-fetch';
import { pool, initializeDatabase } from './db/connect.js';
import { checkAndCreateMetafieldDefinitions } from './utils/metafields.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const {
  SHOPIFY_API_SECRET,
  SESSION_SECRET,
  PORT,
  SHOPIFY_API_KEY,
  SHOPIFY_APP_URL,
  SHOPIFY_APP_HANDLE,
} = process.env;

const app = express();
const port = PORT || 5000;

console.log('Starting server initialization...');

// Set up general middleware for server
console.log('Setting up middleware...');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
console.log('Body parser setup complete.');
app.use(cookieParser());
console.log('Cookie parser setup complete.');
app.use(session({
  secret: SESSION_SECRET || 'default-secret-key', // Ensure SESSION_SECRET is in your .env file
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Change to `true` if you're using HTTPS
}));

console.log('Session middleware setup complete.');

// Serve static files
app.use(express.static('frontend/build'));
console.log('Serving static files from the "frontend/build" directory.');

// Initialize the database upon app start
initializeDatabase()
  .then(() => console.log('Database initialization complete.'))
  .catch((error) => {
    console.error('Database initialization failed:', error);
    process.exit(1); // Exit process if database cannot be initialized
  });

// Shopify-specific verification and setup, triggered when the user accesses the app
app.get('/app', async (req, res, next) => {
  console.log('Entering Shopify app access flow...');
  const { shop, hmac } = req.query;

  // Validate request parameters
  if (!shop || !hmac) {
    console.error('Access denied: missing shop or hmac parameters');
    return res.status(403).send('Access denied. Missing shop or hmac parameters.');
  }

  try {
    // Verify HMAC to ensure the request is valid
    console.log(`Verifying HMAC for shop: ${shop}`);
    const query = Object.keys(req.query)
      .filter((key) => key !== 'hmac' && key !== 'signature')
      .sort()
      .map((key) => `${key}=${req.query[key]}`)
      .join('&');

    const generatedHmac = crypto
      .createHmac('sha256', SHOPIFY_API_SECRET)
      .update(query)
      .digest('hex');

    if (generatedHmac !== hmac) {
      console.error('Access denied: HMAC validation failed.');
      return res.status(403).send('Access denied. Invalid HMAC.');
    }

    console.log('Shopify HMAC validation successful.');

    // Retrieve access token for the shop
    console.log(`Attempting to retrieve or store access token for shop: ${shop}`);
    const result = await pool.query('SELECT access_token FROM stores WHERE shop_domain = $1', [shop]);

    if (result.rows.length === 0) {
      console.log(`No access token found for shop: ${shop}. Starting OAuth flow for access.`);
      // Redirect to install/auth flow if no access token is found
      res.redirect(`/auth?shop=${shop}`);
      return;
    }

    const accessToken = result.rows[0].access_token;
    console.log(`Access token retrieved successfully for shop: ${shop}`);

    // Check and create metafield definitions if needed
    console.log(`Checking and creating metafields for shop: ${shop}`);
    try {
      await checkAndCreateMetafieldDefinitions(shop, accessToken);
      console.log(`Metafield setup completed for shop: ${shop}`);
    } catch (metaError) {
      console.error(`Failed during metafield creation for shop: ${shop}`, metaError);
    }

  } catch (error) {
    console.error(`Error during Shopify app access for shop: ${shop}`, error);
  }

  console.log('Shopify app access flow complete.');
  next();
});

// OAuth Callback Route
app.get('/auth/callback', async (req, res) => {
  const { shop, code } = req.query;

  if (!shop || !code) {
    console.error('OAuth Callback Error: Missing required parameters');
    return res.status(400).send('Missing required parameters');
  }

  try {
    // Exchange the code for an access token
    const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code,
    });

    const accessToken = response.data.access_token;
    console.log(`Access token successfully received for shop: ${shop}`);

    // Store auth details in PostgreSQL
    const storeExists = await pool.query('SELECT * FROM stores WHERE shop_domain = $1', [shop]);

    let storeId;
    if (storeExists.rows.length > 0) {
      // Update existing store record
      await pool.query(
        'UPDATE stores SET access_token = $1 WHERE shop_domain = $2 RETURNING id',
        [accessToken, shop]
      );
      storeId = storeExists.rows[0].id;
      console.log(`Access token updated for shop: ${shop}`);
    } else {
      // Insert new store record
      const newStore = await pool.query(
        'INSERT INTO stores (shop_domain, access_token) VALUES ($1, $2) RETURNING id',
        [shop, accessToken]
      );
      storeId = newStore.rows[0].id;
      console.log(`New store record created for shop: ${shop}`);
    }

    // Create Global Product Metafields if they do not exist
    const metafieldsEndpoint = `https://${shop}/admin/api/2023-04/metafields.json`;

    // Check if 'is_sync_master' metafield exists
    const existingMetafieldsResponse = await axios.get(`https://${shop}/admin/api/2023-04/metafields.json?namespace=sync_logic_${storeId}`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    const existingMetafields = existingMetafieldsResponse.data.metafields;
    const isSyncMasterExists = existingMetafields.some(metafield => metafield.key === 'is_sync_master');
    const linkedProductsExists = existingMetafields.some(metafield => metafield.key === 'linked_products');

    if (!isSyncMasterExists) {
      const metafieldsPayload = {
        metafield: {
          namespace: `sync_logic_${storeId}`,
          key: 'is_sync_master',
          value: 'false',
          value_type: 'boolean',
          type: 'boolean',
          owner_resource: 'product',
        }
      };

      // Create 'is_sync_master' metafield
      await axios.post(metafieldsEndpoint, metafieldsPayload, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });
      console.log(`Global product metafield 'is_sync_master' created for shop: ${shop}`);
    }

    if (!linkedProductsExists) {
      const linkedProductsPayload = {
        metafield: {
          namespace: `sync_logic_${storeId}`,
          key: 'linked_products',
          value: '[]',
          type: 'product_reference_list',
          owner_resource: 'product',
        }
      };

      // Create 'linked_products' metafield
      await axios.post(metafieldsEndpoint, linkedProductsPayload, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });
      console.log(`Global product metafield 'linked_products' created for shop: ${shop}`);
    }

    // Redirect back to Shopify admin interface
    res.redirect(`https://${shop}/admin/apps/${SHOPIFY_APP_HANDLE}`);
  } catch (error) {
    console.error('Error during OAuth token exchange:', error);
    res.status(500).send('Failed to complete OAuth');
  }
});

// Webhook endpoint to handle product updates, order creations, and app uninstallation
app.post('/webhooks/:topic', (req, res) => {
  const { topic } = req.params;
  const shopDomain = req.headers['x-shopify-shop-domain'];
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];

  if (!shopDomain || !hmacHeader) {
    console.error('Webhook error: Missing required headers.');
    return res.status(400).send('Bad Request: Missing required headers.');
  }

  const body = JSON.stringify(req.body);
  const generatedHmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(body, 'utf8')
    .digest('base64');

  if (generatedHmac !== hmacHeader) {
    console.error('Webhook error: HMAC validation failed.');
    return res.status(401).send('Unauthorized: Invalid HMAC.');
  }

  console.log(`Received ${topic} webhook for shop: ${shopDomain}`);

  switch (topic) {
    case 'products/update':
      console.log('Handling product update webhook...');
      // Add logic to handle product updates
      break;
    case 'orders/create':
      console.log('Handling order creation webhook...');
      // Add logic to handle order creations
      break;
    case 'app/uninstalled':
      console.log('Handling app uninstallation webhook...');
      // Add logic to handle app uninstallation (e.g., remove store data)
      pool.query('DELETE FROM stores WHERE shop_domain = $1', [shopDomain])
        .then(() => console.log(`Store data removed for shop: ${shopDomain}`))
        .catch((error) => console.error('Error removing store data:', error));
      break;
    default:
      console.error(`Unhandled webhook topic: ${topic}`);
  }

  res.status(200).send('Webhook processed successfully.');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Catch-all route to handle React routing (e.g., /app/* routes)
app.get('*', (req, res) => {
  res.sendFile(path.resolve('frontend', 'build', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

// Error Handling for server crash and restarts
import sendAlertEmail from './alert.js';

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  sendAlertEmail(error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  sendAlertEmail(reason);
});

export default app;
