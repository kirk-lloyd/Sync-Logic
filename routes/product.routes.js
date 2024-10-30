import express from 'express';
import Product from '../models/product.model.js';
import Bundle from '../models/bundle.model.js';

const router = express.Router();

// Endpoint to set a product as sync master
router.post('/set-sync-master', async (req, res) => {
  const { productId, linkedProductIds, storeId } = req.body;

  try {
    // Find product and mark it as sync master
    await Product.updateOne(
      { product_id: productId, store_id: storeId },
      { is_sync_master: true }
    );

    // Link other products by creating a new bundle entry
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

// Example endpoint to fetch products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({ store_id: req.store._id });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
