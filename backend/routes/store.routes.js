import express from 'express';
import { pool } from '../db/connect.js';

const router = express.Router();

// Endpoint to register a new store
router.post('/register', async (req, res) => {
  const { shop_domain, access_token } = req.body;

  if (!shop_domain || !access_token) {
    return res.status(400).json({ message: 'Missing shop_domain or access_token in request body' });
  }

  try {
    const queryText = 'SELECT * FROM stores WHERE shop_domain = $1';
    const result = await pool.query(queryText, [shop_domain]);

    if (result.rows.length > 0) {
      return res.status(409).json({ message: 'Store already registered' });
    }

    const insertText = `
      INSERT INTO stores (shop_id, shop_domain, access_token, created_at)
      VALUES (gen_random_uuid(), $1, $2, NOW())
    `;
    await pool.query(insertText, [shop_domain, access_token]);

    res.status(201).json({ message: 'Store registered successfully' });
  } catch (error) {
    console.error('Error registering store:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
