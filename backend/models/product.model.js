import { pool } from '../db/connect.js';

// Function to create a new product
export const createProduct = async (storeId, title, sku, inventoryQuantity, productType, vendor) => {
  const query = `
    INSERT INTO products (store_id, title, sku, inventory_quantity, product_type, vendor, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *;
  `;
  const values = [storeId, title, sku, inventoryQuantity, productType, vendor];

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};
