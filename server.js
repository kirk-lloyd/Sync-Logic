import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import path from 'path';
import axios from 'axios';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import qs from 'qs';
import session from 'express-session';

// Import models
import Store from './models/store.model.js';

// Import routes
import productRoutes from './routes/product.routes.js';
import storeRoutes from './routes/store.routes.js';

const app = express();
const port = process.env.PORT || 3000;

// Shopify credentials from environment variables
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL;
const TEST_STORE_URL = process.env.TEST_STORE_URL || 'projekt-agency-apps.myshopify.com';
const MONGODB_URI = process.env.MONGODB_URI;

// Create __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// Middleware setup
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Middleware to verify Shopify webhook authenticity
function verifyWebhook(req, res, next) {
  try {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const secret = SHOPIFY_API_SECRET;
    const hash = crypto.createHmac('sha256', secret).update(req.rawBody).digest('base64');

    if (hash === hmacHeader) {
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
  const shopDomain = req.headers['x-shopify-shop-domain'];
  try {
    await Store.findOneAndDelete({ shop_domain: shopDomain });
    console.log(`Data for ${shopDomain} removed upon app uninstall.`);
    res.status(200).send('App uninstalled');
  } catch (error) {
    console.error('Error handling app/uninstalled webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Middleware to ensure access token is valid or redirect to OAuth flow if not
async function ensureAccessToken(req, res, next) {
  const shopDomain = req.headers['shop-domain'] || TEST_STORE_URL;

  try {
    const store = await Store.findOne({ shop_domain: shopDomain });
    
    if (!store || !store.access_token) {
      console.log(`Store not found or access token missing for ${shopDomain}. Redirecting to OAuth flow.`);
      return res.redirect(`/initiate-auth?shop=${shopDomain}`);
    }
    console.log(`Found store for ${shopDomain} with access token ${store.access_token}`);
    next();
  } catch (error) {
    console.error('Error in ensureAccessToken middleware:', error);
    res.status(500).send('Internal Server Error');
  }
}

// Initiate authentication route
app.get('/initiate-auth', (req, res) => {
  const shop = req.query.shop;
  if (!shop) {
    console.error('Shop parameter missing');
    return res.status(400).send('Shop parameter missing');
  }

  const redirectUri = `${SHOPIFY_APP_URL}/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${process.env.SHOPIFY_SCOPES}&redirect_uri=${redirectUri}`;

  res.redirect(installUrl);
});

// OAuth Callback Route (incremental debugging)
app.get('/auth/callback', async (req, res) => {
  console.log("OAuth callback route triggered");

  const { shop, code, hmac, ...rest } = req.query;
  if (!shop || !code || !hmac) {
    console.error("Required parameters missing in OAuth callback");
    return res.status(400).send("Required parameters missing");
  }
  console.log("Shop, code, and HMAC parameters are present");

  // Construct the message for HMAC validation by sorting query parameters
  const queryParams = { ...rest, shop, code };
  const sortedQuery = Object.keys(queryParams)
    .sort()
    .map((key) => `${key}=${queryParams[key]}`)
    .join('&');

  // Generate HMAC using the sorted query string and the SHOPIFY_API_SECRET
  const calculatedHmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(sortedQuery)
    .digest('hex');

  if (calculatedHmac !== hmac) {
    console.error("HMAC validation failed.");
    return res.status(400).send("HMAC validation failed");
  }
  console.log("HMAC validation passed");

  // Request the access token from Shopify
  const accessTokenRequestUrl = `https://${shop}/admin/oauth/access_token`;
  const accessTokenPayload = {
    client_id: SHOPIFY_API_KEY,
    client_secret: SHOPIFY_API_SECRET,
    code,
  };

  try {
    const response = await axios.post(accessTokenRequestUrl, accessTokenPayload);
    console.log("Received response from Shopify:", response.data);

    if (response.data && response.data.access_token) {
      const accessToken = response.data.access_token;
      console.log(`Access token retrieved: ${accessToken}`);

      // Save or update shop and access token in MongoDB
      const storeData = { shop_domain: shop, access_token: accessToken };
      const updatedStore = await Store.findOneAndUpdate(
        { shop_domain: shop },
        storeData,
        { upsert: true, new: true }
      );

      if (updatedStore) {
        console.log(`Successfully stored access token in MongoDB for ${shop}`);
      } else {
        console.error(`Failed to save access token for ${shop} in MongoDB`);
      }

      // Redirect back to the app within the Shopify admin
      res.redirect(`https://${shop}/admin/apps/${process.env.SHOPIFY_APP_HANDLE}`);
    } else {
      console.error("Access token missing in Shopify response:", response.data);
      return res.status(500).send("Access token missing in response");
    }
  } catch (error) {
    console.error("Error during OAuth callback:", error.message);
    console.error("Full error:", error); // Detailed error logging
    res.status(500).send("Internal Server Error");
  }
});

// Protected route example (use access token to get products)
app.get('/api/products', ensureAccessToken, async (req, res) => {
  const shopDomain = req.query.shop || TEST_STORE_URL;

  try {
    const store = await Store.findOne({ shop_domain: shopDomain });
    if (!store || !store.access_token) {
      console.error(`Access token not found in database for shop: ${shopDomain}`);
      return res.status(401).send('Access token is missing');
    }

    console.log(`Fetching products for shop: ${shopDomain}`);
    const response = await axios.get(`https://${store.shop_domain}/admin/api/2023-04/products.json`, {
      headers: { 'X-Shopify-Access-Token': store.access_token },
      params: { status: 'active', fields: 'id,title,variants,product_type,vendor' },
    });

    const formattedProducts = response.data.products.map(product => ({
      id: product.id,
      name: product.title,
      sku: product.variants[0].sku,
      inventory: product.variants[0].inventory_quantity,
      type: product.product_type,
      vendor: product.vendor,
      isSyncMaster: false,
    }));

    res.json(formattedProducts);
  } catch (error) {
    console.error('Error fetching products from Shopify:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

// Use imported routes
app.use('/api/products', productRoutes);
app.use('/api/stores', storeRoutes);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'public')));

// Serve React App for any unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
