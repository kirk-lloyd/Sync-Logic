import { pool } from '../db/connect.js';

// Function to create a new bundle
export const createBundle = async (storeId, masterProductId, linkedProductIds) => {
  const query = `
    INSERT INTO bundles (store_id, master_product_id, linked_product_ids, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *;
  `;
  const values = [storeId, masterProductId, linkedProductIds];

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating bundle:', error);
    throw error;
  }
};
