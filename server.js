import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Shopify credentials from environment variables
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

// Create __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware to parse incoming JSON requests
app.use(bodyParser.json());

// Middleware to verify Shopify webhook authenticity
function verifyWebhook(req, res, next) {
  try {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const secret = SHOPIFY_API_SECRET;

    // Shopify sends the raw request body to calculate HMAC, so use 'raw-body-parser' or similar to ensure raw body handling.
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

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'public')));

// Serve React App for any unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to fetch products from Shopify
app.get('/api/products', async (req, res) => {
  try {
    const response = await axios.get(`https://${SHOPIFY_STORE_URL}/admin/api/2023-04/products.json`, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_API_KEY,
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

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
