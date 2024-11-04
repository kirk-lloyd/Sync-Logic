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
import csrf from 'csurf';
import cookieParser from 'cookie-parser';

// Import models
import Store from './models/store.model.js';
import Product from './models/product.model.js';
import Bundle from './models/bundle.model.js';

// Import routes
import productRoutes from './routes/product.routes.js';
import storeRoutes from './routes/store.routes.js';

dotenv.config();

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

// Middleware to parse incoming JSON requests
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf; // Attach raw body buffer to request
  }
}));

// Enable CORS
app.use(cors());

// Enable cookie parsing
app.use(cookieParser());

// Enable CSRF protection for HTML forms only
const csrfProtection = csrf({ cookie: true });

// Middleware to verify Shopify webhook authenticity
function verifyWebhook(req, res, next) {
  try {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const secret = SHOPIFY_API_SECRET;

    const hash = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody)
      .digest('base64');

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

// Compliance Webhooks Endpoint
app.post('/webhooks/compliance_webhooks', verifyWebhook, (req, res) => {
  const topic = req.headers['x-shopify-topic'];
  const body = req.body;

  try {
    switch (topic) {
      case 'customers/redact':
        handleCustomerRedact(body);
        break;
      case 'shop/redact':
        handleShopRedact(body);
        break;
      case 'customers/data_request':
        handleCustomerDataRequest(body);
        break;
      default:
        console.error('Unknown compliance topic');
    }

    res.status(200).send('Webhook received');
  } catch (error) {
    console.error('Error handling compliance webhook:', error);
    res.status(500).send('Error handling webhook');
  }
});

// Handlers for the compliance webhooks
function handleCustomerRedact(body) {
  const customerId = body.customer.id;
  console.log(`Customer Redact webhook received for customer ID: ${customerId}`);
  // TODO: Implement the logic to delete customer data from your database
}

function handleShopRedact(body) {
  const shopId = body.shop_id;
  console.log(`Shop Redact webhook received for shop ID: ${shopId}`);
  // TODO: Implement the logic to delete all data related to the specified shop
}

function handleCustomerDataRequest(body) {
  const customerId = body.customer.id;
  console.log(`Customer Data Request webhook received for customer ID: ${customerId}`);
  // TODO: Implement logic to gather all data for the customer and send it to the store owner
}

// OAuth Flow to Start the Authentication Process
app.get('/auth', csrfProtection, (req, res) => {
  const shop = req.query.shop || TEST_STORE_URL;

  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }

  const redirectUri = `${SHOPIFY_APP_URL}/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${process.env.SHOPIFY_SCOPES}&redirect_uri=${redirectUri}`;

  res.redirect(installUrl);
});

// OAuth Callback to Exchange Code for Access Token
app.get('/auth/callback', async (req, res) => {
  const { shop, hmac, code } = req.query;

  if (!shop || !hmac || !code) {
    return res.status(400).send('Required parameters missing');
  }

  // Verify the HMAC (this part is skipped for simplicity)

  const accessTokenRequestUrl = `https://${shop}/admin/oauth/access_token`;
  const accessTokenPayload = {
    client_id: SHOPIFY_API_KEY,
    client_secret: SHOPIFY_API_SECRET,
    code,
  };

  try {
    const response = await axios.post(accessTokenRequestUrl, accessTokenPayload);
    const accessToken = response.data.access_token;

    // Save shop and access token in MongoDB
    const store = await Store.findOneAndUpdate(
      { shop_domain: shop },
      { shop_domain: shop, access_token: accessToken },
      { upsert: true, new: true }
    );

    // After successful authentication, redirect to the client's embedded Shopify page
    res.redirect(`https://${shop}/admin/apps/${process.env.SHOPIFY_APP_HANDLE}`);
  } catch (error) {
    console.error('Error during OAuth callback:', error);
    res.status(500).send('Error during authentication');
  }
});

// Endpoint to fetch products from Shopify
app.get('/api/products', async (req, res) => {
  const shopDomain = req.headers['shop-domain'] || TEST_STORE_URL;

  try {
    const store = await Store.findOne({ shop_domain: shopDomain });
    if (!store) {
      return res.status(404).send('Store not found');
    }

    const response = await axios.get(`https://${store.shop_domain}/admin/api/2023-04/products.json`, {
      headers: {
        'X-Shopify-Access-Token': store.access_token,
      },
      params: {
        status: 'active',
        fields: 'id,title,variants,product_type,vendor',
      },
    });

    const products = response.data.products;

    // Format product data for the frontend
    const formattedProducts = products.map(product => ({
      id: product.id,
      name: product.title,
      sku: product.variants[0].sku,
      inventory: product.variants[0].inventory_quantity,
      type: product.product_type,
      vendor: product.vendor,
      isSyncMaster: false // Default value, modify based on your logic
    }));

    res.json(formattedProducts);
  } catch (error) {
    console.error('Error fetching products from Shopify:', error);
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
