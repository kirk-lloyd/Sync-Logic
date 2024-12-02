import express from 'express';
import { verifyWebhook } from '../middlewares/shopify.middleware.js';
import { getClient } from '../db/connect.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SHOPIFY_APP_HANDLE,
} = process.env;

const router = express.Router();

// OAuth callback route for Shopify
router.get('/auth/callback', async (req, res) => {
  const { shop, code } = req.query;

  if (!shop || !code) {
    console.error('OAuth Callback Error: Missing required parameters');
    return res.status(400).send('Missing required parameters');
  }

  let client;

  try {
    // Exchange the code for an access token
    const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code,
    });

    const accessToken = response.data.access_token;
    console.log(`Access token successfully received for shop: ${shop}`);

    // Get database client and handle the store record
    client = await getClient();
    const storeExists = await client.query('SELECT * FROM stores WHERE shop_domain = $1', [shop]);

    if (storeExists.rows.length > 0) {
      // Update existing store record
      await client.query(
        'UPDATE stores SET access_token = $1 WHERE shop_domain = $2',
        [accessToken, shop]
      );
      console.log(`Access token updated for shop: ${shop}`);
    } else {
      // Insert new store record
      await client.query(
        'INSERT INTO stores (shop_domain, access_token) VALUES ($1, $2)',
        [shop, accessToken]
      );
      console.log(`New store record created for shop: ${shop}`);
    }

    // Redirect back to Shopify admin interface
    res.redirect(`https://${shop}/admin/apps/${SHOPIFY_APP_HANDLE}`);
  } catch (error) {
    console.error('Error during OAuth token exchange:', error);
    res.status(500).send('Failed to complete OAuth');
  } finally {
    if (client) client.release();
  }
});

// Webhook for app uninstallation
router.post('/webhooks/app/uninstalled', verifyWebhook, async (req, res) => {
  let client;
  try {
    client = await getClient();

    const shopDomain = req.headers['x-shop-domain'];

    if (!shopDomain) {
      console.error('Missing shop domain in request headers');
      return res.status(400).send('Bad Request: Missing shop domain');
    }

    // Delete the store from the database
    await client.query('DELETE FROM stores WHERE shop_domain = $1', [shopDomain]);

    console.log(`Store data for ${shopDomain} removed upon app uninstall.`);
    res.status(200).send('App uninstalled successfully');
  } catch (error) {
    console.error('Error handling app/uninstalled webhook:', error);
    res.status(500).send('Internal Server Error');
  } finally {
    if (client) client.release();
  }
});

export default router;
