import express from 'express';
import { checkAndCreateMetafieldDefinitions } from '../utils/metafields.js';

const router = express.Router();

// Route to check and create metafield definitions
router.post('/check-and-create-metafields', async (req, res) => {
  const { shop, accessToken } = req.body;

  if (!shop || !accessToken) {
    return res.status(400).json({ error: 'Shop and access token are required' });
  }

  try {
    await checkAndCreateMetafieldDefinitions(shop, accessToken);
    res.status(200).json({ message: 'Metafield definitions checked and created if necessary' });
  } catch (error) {
    console.error('Error checking/creating metafields:', error);
    res.status(500).json({ error: 'Failed to check/create metafield definitions' });
  }
});

export default router;
