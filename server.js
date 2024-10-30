import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import path from 'path';
import axios from 'axios';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

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
app.get('/auth', (req, res) => {
  const shop = req.query.shop;

  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }

  const redirectUri = `${process.env.SHOPIFY_APP_URL}/auth/callback`;
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

    res.status(200).send('Shop successfully authenticated');
  } catch (error) {
    console.error('Error during OAuth callback:', error);
    res.status(500).send('Error during authentication');
  }
});

// Product Update Webhook Endpoint
app.post('/webhooks/products/update', verifyWebhook, async (req, res) => {
  try {
    const productData = req.body;
    const storeDomain = req.headers['x-shopify-shop-domain'];

    // Fetch the store information from the database
    const store = await Store.findOne({ shop_domain: storeDomain });

    if (!store) {
      console.error(`Store not found for domain: ${storeDomain}`);
      return res.status(404).send('Store not found');
    }

    // Update product in the database
    const existingProduct = await Product.findOne({ product_id: productData.id, store_id: store._id });
    if (existingProduct) {
      // Update existing product details
      existingProduct.title = productData.title;
      existingProduct.inventory_quantity = productData.variants[0].inventory_quantity;
      await existingProduct.save();
    } else {
      // Create a new product entry if it doesn't exist
      await Product.create({
        product_id: productData.id,
        store_id: store._id,
        title: productData.title,
        sku: productData.variants[0].sku,
        inventory_quantity: productData.variants[0].inventory_quantity,
        product_type: productData.product_type,
        vendor: productData.vendor,
      });
    }

    res.status(200).send('Product updated successfully');
  } catch (error) {
    console.error('Error handling product update webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to fetch products from Shopify
app.get('/api/products', async (req, res) => {
  const shopDomain = req.headers['shop-domain'];

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

// Endpoint to set a product as sync master
app.post('/api/set-sync-master', async (req, res) => {
  const { productId, linkedProductIds, storeId } = req.body;

  try {
    // Find product and mark it as sync master
    await Product.updateOne(
      { _id: productId, store_id: storeId },
      { is_sync_master: true }
    );

    // Link other products
    await Bundle.create({
      store_id: storeId,
      master_product_id: productId,
      linked_product_ids: linkedProductIds,
    });

    res.status(200).json({ message: 'Sync master set successfully' });
  } catch (error) {
    console.error('Error setting sync master:', error);
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
