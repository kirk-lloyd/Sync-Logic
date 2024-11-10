import express from 'express';
import { verifyWebhook, useStoreDatabase } from '../middlewares/shopify.middleware.js';
import { handleOAuthCallback, handleAppUninstall } from '../controllers/shopify.controller.js';

const router = express.Router();

// OAuth callback route for Shopify
router.get('/auth/callback', handleOAuthCallback);

// Webhook for app uninstallation
router.post('/webhooks/app/uninstalled', verifyWebhook, async (req, res, next) => {
  try {
    await useStoreDatabase(req, res, next);
  } catch (error) {
    console.error('Error in store database lookup:', error);
    return res.status(500).send('Internal Server Error');
  }
  handleAppUninstall(req, res);
});

export default router;
