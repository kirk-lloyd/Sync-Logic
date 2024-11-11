import dotenv from 'dotenv';
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import Store from './models/store.model.js';
import productRoutes from './routes/product.routes.js';
import storeRoutes from './routes/store.routes.js';

dotenv.config();

const { Pool } = pkg;

// Database connection setup
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.connect()
  .then(() => console.log('Connected to PostgreSQL database successfully.'))
  .catch((error) => {
    console.error('Failed to connect to PostgreSQL database:', error);
    process.exit(1); // Exit if unable to connect to DB
  });

// Create __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting server initialization...');

const app = express();
const port = process.env.PORT || 3000;

// Shopify credentials from environment variables
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

// Middleware setup
console.log('Setting up middleware...');

// Body Parser to parse JSON requests
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
console.log('Body parser setup complete.');

// Cookie Parser to manage cookies
app.use(cookieParser());
console.log('Cookie parser setup complete.');

// Express Session for session management
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    },
  })
);
console.log('Session middleware setup complete.');

// Middleware to verify Shopify-embedded app request
app.use('/app', (req, res, next) => {
  const { shop, hmac } = req.query;

  if (!shop || !hmac) {
    console.error('Access denied: missing shop or hmac parameters');
    return res.status(403).send('Access denied. Missing shop or hmac parameters.');
  }

  // Verify HMAC to ensure the request is valid
  const query = Object.keys(req.query)
    .filter((key) => key !== 'hmac' && key !== 'signature')
    .sort()
    .map((key) => `${key}=${req.query[key]}`)
    .join('&');

  const generatedHmac = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(query)
    .digest('hex');

  if (generatedHmac !== hmac) {
    console.error('Access denied: HMAC validation failed.');
    return res.status(403).send('Access denied. Invalid HMAC.');
  }

  console.log('Shopify HMAC validation successful.');
  next();
});
console.log('Shopify verification middleware setup complete.');

// Log every incoming request
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Middleware to add store credentials to requests
async function addStoreCredentials(req, res, next) {
  const shop = req.query.shop || req.headers['x-shopify-shop-domain'];

  if (!shop) {
    console.error('Shop domain not provided.');
    return res.status(400).send('Shop domain is required.');
  }

  try {
    const result = await pool.query('SELECT * FROM stores WHERE shop_domain = $1', [shop]);
    const store = result.rows[0];

    if (!store) {
      console.error(`Store not found for domain: ${shop}`);
      return res.status(404).send('Store not found.');
    }

    req.store = store; // Attach store to request for easy access
    console.log(`Store credentials added for ${shop}`);
    next();
  } catch (error) {
    console.error('Error retrieving store credentials:', error);
    res.status(500).send('Internal Server Error');
  }
}

// Middleware to verify Shopify webhook authenticity
function verifyWebhook(req, res, next) {
  console.log('Verifying webhook...');
  try {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const hash = crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET).update(req.rawBody).digest('base64');

    const isVerified = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
    if (isVerified) {
      console.log('Webhook verification successful.');
      next();
    } else {
      console.error('Webhook verification failed. Possible unauthorized access attempt.');
      res.status(401).send('Unauthorized');
    }
  } catch (error) {
    console.error('Error in webhook verification:', error);
    res.status(500).send('Internal Server Error');
  }
}

// Handle App Uninstallation
app.post('/webhooks/app/uninstalled', verifyWebhook, async (req, res) => {
  console.log('Processing app/uninstalled webhook...');
  const shopDomain = req.headers['x-shopify-shop-domain'];
  try {
    await pool.query('DELETE FROM stores WHERE shop_domain = $1', [shopDomain]);
    console.log(`Data for ${shopDomain} removed upon app uninstall.`);
    res.status(200).send('App uninstalled');
  } catch (error) {
    console.error('Error handling app/uninstalled webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// OAuth Callback Route
app.get('/auth/callback', async (req, res) => {
  console.log('Handling OAuth callback...');
  const { shop, code, hmac, state, ...rest } = req.query;

  if (!shop || !code || !hmac || !state) {
    console.error('Missing required parameters in OAuth callback.');
    return res.status(400).send('Required parameters missing');
  }

  console.log('OAuth callback parameters received:', req.query);

  // Construct the message for HMAC validation by sorting query parameters
  const queryParams = { ...rest, shop, code, state };
  const sortedQuery = Object.keys(queryParams)
    .sort()
    .map((key) => `${key}=${queryParams[key]}`)
    .join('&');

  // Generate HMAC using the sorted query string and the SHOPIFY_API_SECRET
  const calculatedHmac = crypto.createHmac('sha256', SHOPIFY_API_SECRET).update(sortedQuery).digest('hex');

  if (calculatedHmac !== hmac) {
    console.error('HMAC validation failed during OAuth callback.');
    return res.status(400).send('HMAC validation failed');
  }

  console.log('HMAC validation successful.');

  // Request the access token from Shopify
  const accessTokenRequestUrl = `https://${shop}/admin/oauth/access_token`;
  const accessTokenPayload = {
    client_id: SHOPIFY_API_KEY,
    client_secret: SHOPIFY_API_SECRET,
    code,
  };

  try {
    console.log('Requesting access token from Shopify...');
    const response = await axios.post(accessTokenRequestUrl, accessTokenPayload);
    if (response.data && response.data.access_token) {
      const accessToken = response.data.access_token;

      console.log('Access token received:', accessToken);

      // Save or update shop and access token in the database
      const storeData = { shop_domain: shop, access_token: accessToken };
      const updatedStore = await pool.query(
        `INSERT INTO stores (shop_domain, access_token)
         VALUES ($1, $2)
         ON CONFLICT (shop_domain) DO UPDATE SET access_token = $2 RETURNING *`,
        [shop, accessToken]
      );

      if (updatedStore.rows[0]) {
        console.log(`Successfully stored access token in PostgreSQL for ${shop}`);
      } else {
        console.error(`Failed to save access token for ${shop} in PostgreSQL`);
      }

      // Redirect back to the app within the Shopify admin
      console.log('Redirecting to Shopify app...');
      res.redirect(`https://${shop}/admin/apps/${process.env.SHOPIFY_APP_HANDLE}`);
    } else {
      console.error('Access token missing in Shopify response:', response.data);
      return res.status(500).send('Access token missing in response');
    }
  } catch (error) {
    console.error('Error during OAuth callback:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

// Use imported routes with store credentials middleware
app.use('/api/products', addStoreCredentials, productRoutes);
app.use('/api/stores', addStoreCredentials, storeRoutes);

// Serve static files from the React app
console.log("Serving static files from the 'public' directory.");
app.use(express.static(path.join(__dirname, 'public')));

// Serve React App for any unknown routes
app.get('*', (req, res) => {
  console.log('Fallback route triggered, serving React app...');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
