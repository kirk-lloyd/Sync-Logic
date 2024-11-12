import { pool } from '../db/connect.js';
import crypto from 'crypto';

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

  try {
    console.log(`Querying store data for shop: ${shopDomain}`);

    // Use the pool to query the database
    const queryText = 'SELECT * FROM stores WHERE shop_id = $1';
    const result = await pool.query(queryText, [shopId]);

    if (result.rows.length === 0) {
      console.error(`Store not found for shop ID: ${shopId}`);
      return res.status(404).send('Store not found');
    }

    // Attach store information to the request
    req.store = result.rows[0];
    next();
  } catch (error) {
    console.error(`Error retrieving store data for ${shopDomain}:`, error);
    res.status(500).send('Internal Server Error');
  }
};
