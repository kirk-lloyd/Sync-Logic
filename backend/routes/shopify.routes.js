import express from 'express';
import { verifyWebhook } from '../middlewares/shopify.middleware.js';
import { getClient } from '../db/connect.js';
import { handleOAuthCallback, handleAppUninstall } from '../controllers/shopify.controller.js';

const router = express.Router();

// OAuth callback route for Shopify
router.get('/auth/callback', handleOAuthCallback);

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
