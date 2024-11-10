import express from 'express';
import Store from '../models/store.model.js';

const router = express.Router();

// Endpoint to register a new store
router.post('/register', async (req, res) => {
  const { shop_domain, access_token } = req.body;

  try {
    const existingStore = await Store.findOne({ shop_domain });
    if (existingStore) {
      return res.status(409).json({ message: 'Store already registered' });
    }

    const newStore = new Store({
      shop_domain,
      access_token,
    });
    await newStore.save();

    res.status(201).json({ message: 'Store registered successfully', store: newStore });
  } catch (error) {
    console.error('Error registering store:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
