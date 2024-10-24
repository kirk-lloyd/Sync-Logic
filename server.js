import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';

const app = express();
const port = 3000;

// Middleware to parse incoming JSON requests
app.use(bodyParser.json());

// Middleware to verify Shopify webhook authenticity
function verifyWebhook(req, res, next) {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const body = JSON.stringify(req.body);
  const secret = process.env.SHOPIFY_API_SECRET;

  const hash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8', 'hex')
    .digest('base64');

  if (hash === hmacHeader) {
    next();
  } else {
    res.status(401).send('Unauthorized');
  }
}

// Compliance Webhooks Endpoint
app.post('/webhooks/compliance_webhooks', verifyWebhook, (req, res) => {
  const topic = req.headers['x-shopify-topic'];
  const body = req.body;

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

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
