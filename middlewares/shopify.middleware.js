import { createStoreConnection } from '../db/connect.js';
import crypto from 'crypto';

// Cache for store connections to avoid redundant connections
const storeConnections = {};

// Middleware to verify Shopify webhook authenticity
export const verifyWebhook = (req, res, next) => {
  try {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const secret = process.env.SHOPIFY_API_SECRET;
    const hash = crypto.createHmac('sha256', secret).update(req.rawBody).digest('base64');

    const isVerified = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
    if (isVerified) {
      next();
    } else {
      console.error('Webhook verification failed. Possible unauthorized access attempt.');
      res.status(401).send('Unauthorized');
    }
  } catch (error) {
    console.error('Error in webhook verification:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Middleware to use the appropriate database for each store
export const useStoreDatabase = async (req, res, next) => {
  const shopDomain = req.headers['shop-domain'];
  const shopId = req.headers['shop-id']; // Assuming shop ID is being provided in the headers

  if (!shopDomain || !shopId) {
    return res.status(400).send('Shop domain or shop ID missing in request headers');
  }

  // Attempt to reuse an existing connection if available
  if (storeConnections[shopId]) {
    req.dbConnection = storeConnections[shopId];
    console.log(`Reusing existing connection for shop: ${shopDomain}`);
    return next();
  }

  try {
    console.log(`Creating new connection for shop: ${shopDomain}`);
    const connection = await createStoreConnection(shopId);

    if (!connection) {
      throw new Error(`Failed to create or retrieve connection for shop: ${shopDomain}`);
    }

    storeConnections[shopId] = connection;
    req.dbConnection = connection;

    // Find and attach store information to the request
    const StoreModel = req.dbConnection.model('Store', new mongoose.Schema({
      shop_domain: String,
      access_token: String,
    }));

    const store = await StoreModel.findOne({ shop_domain: shopDomain });

    if (!store) {
      console.error(`Store not found for domain: ${shopDomain}`);
      return res.status(404).send('Store not found');
    }

    req.store = store;
    next();
  } catch (error) {
    console.error(`Error connecting to unique database for ${shopDomain}:`, error);
    res.status(500).send('Internal Server Error');
  }
};
