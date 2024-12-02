// Import necessary libraries
import express from 'express';
import { pool } from '../db/connect.js'; // Use pool from connect.js
import { useStoreDatabase } from '../middlewares/shopify.middleware.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const router = express.Router();

// Apply middleware to use store-specific database
router.use(useStoreDatabase);

// Endpoint to handle GraphQL request for products
router.post('/graphql', async (req, res) => {
    console.log('Received request to /api/products/graphql');
    console.log('Request query parameters:', req.query);
    console.log('Request headers:', req.headers);

    const shopDomain = req.headers['x-shop-domain'] || req.query.shop;

    if (!shopDomain) {
        console.error('Missing shop domain in request headers or query parameters');
        return res.status(400).send('Bad Request: Missing shop domain');
    }

    const query = req.body.query;
    if (!query) {
        console.error('Missing GraphQL query in request body');
        return res.status(400).send('Bad Request: Missing GraphQL query');
    }

    try {
        console.log(`Looking for access token for shop: ${shopDomain}`);
        
        const result = await pool.query('SELECT access_token FROM stores WHERE shop_domain = $1', [shopDomain]);
        
        if (result.rows.length === 0 || !result.rows[0].access_token) {
            console.error('No access token found for shop:', shopDomain);
            return res.status(401).send('Unauthorized: Access token missing');
        }

        const accessToken = result.rows[0].access_token;
        console.log('Access token retrieved successfully for shop:', shopDomain);

        // Initialize Shopify GraphQL client
        console.log('Initializing Shopify GraphQL client for the given shop...');
        const endpoint = `https://${shopDomain}/admin/api/2023-04/graphql.json`;

        // Making GraphQL request
        const graphqlResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken
            },
            body: JSON.stringify({ query })
        });

        if (!graphqlResponse.ok) {
            const responseText = await graphqlResponse.text();
            console.error(`GraphQL request failed: ${graphqlResponse.status} - ${graphqlResponse.statusText}`);
            console.error('Response body:', responseText);
            return res.status(graphqlResponse.status).send(responseText);
        }

        const graphqlData = await graphqlResponse.json();
        if (graphqlData.errors) {
            console.error('Errors returned from Shopify GraphQL:', graphqlData.errors);
            return res.status(500).json({ errors: graphqlData.errors });
        }

        console.log('Successfully fetched data from Shopify GraphQL');
        res.json(graphqlData);
    } catch (error) {
        console.error('Error fetching products from Shopify GraphQL:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

// Endpoint to set a product as the sync master
router.post('/products/:productId/sync-master', async (req, res) => {
  const { productId } = req.params;
  const shopDomain = req.headers['x-shop-domain'] || req.query.shop;

  if (!productId || !shopDomain) {
    console.error('Product ID and shop domain are required.');
    return res.status(400).send('Product ID and shop domain are required.');
  }

  try {
    const result = await pool.query('SELECT access_token FROM stores WHERE shop_domain = $1', [shopDomain]);

    if (result.rows.length === 0 || !result.rows[0].access_token) {
      console.error('No access token found for shop:', shopDomain);
      return res.status(401).send('Unauthorized: Access token missing');
    }

    const accessToken = result.rows[0].access_token;

    // Retrieve the product's metafields to check if it is already a child
    const metafieldsEndpoint = `https://${shopDomain}/admin/api/2023-04/products/${productId}/metafields.json`;
    const metafieldsResponse = await axios.get(metafieldsEndpoint, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    const linkedProductsMetafield = metafieldsResponse.data.metafields.find(
      (metafield) => metafield.key === 'linked_products' && metafield.namespace === `sync_logic_${shopDomain}`
    );

    if (linkedProductsMetafield) {
      console.error(`Product ${productId} is a child product and cannot be set as a sync master.`);
      return res.status(400).send('A child product cannot be set as a sync master.');
    }

    // Update the product's metafield to set it as a Sync Master
    const metafieldPayload = {
      metafield: {
        namespace: `sync_logic_${shopDomain}`, // Use a unique namespace
        key: 'is_sync_master',
        value: 'true',
        type: 'boolean',
      },
    };

    const response = await axios.post(metafieldsEndpoint, metafieldPayload, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 201) {
      console.log(`Product ${productId} is now set as sync master for shop: ${shopDomain}`);
      res.status(200).send(`Product ${productId} is now the sync master.`);
    } else {
      console.error('Failed to set product as sync master');
      res.status(response.status).send('Failed to set product as sync master');
    }
  } catch (error) {
    console.error('Error setting product as sync master:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to synchronize inventory across linked products
router.post('/products/:productId/sync-inventory', async (req, res) => {
  const { productId } = req.params;
  const shopDomain = req.headers['x-shop-domain'] || req.query.shop;
  const { inventoryQuantity } = req.body;

  if (!productId || !shopDomain || inventoryQuantity === undefined) {
    console.error('Product ID, shop domain, and inventory quantity are required.');
    return res.status(400).send('Product ID, shop domain, and inventory quantity are required.');
  }

  try {
    const result = await pool.query('SELECT access_token FROM stores WHERE shop_domain = $1', [shopDomain]);

    if (result.rows.length === 0 || !result.rows[0].access_token) {
      console.error('No access token found for shop:', shopDomain);
      return res.status(401).send('Unauthorized: Access token missing');
    }

    const accessToken = result.rows[0].access_token;

    // Retrieve linked products from the master product's metafield
    const metafieldsEndpoint = `https://${shopDomain}/admin/api/2023-04/products/${productId}/metafields.json`;
    const metafieldsResponse = await axios.get(metafieldsEndpoint, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    const linkedProductsMetafield = metafieldsResponse.data.metafields.find(
      (metafield) => metafield.key === 'linked_products' && metafield.namespace === `sync_logic_${shopDomain}`
    );

    if (!linkedProductsMetafield) {
      console.error('No linked products metafield found for product:', productId);
      return res.status(404).send('No linked products metafield found');
    }

    const linkedProductIds = linkedProductsMetafield.value;

    // Update inventory for all linked products
    for (const linkedProductId of linkedProductIds) {
      const updateEndpoint = `https://${shopDomain}/admin/api/2023-04/products/${linkedProductId}.json`;
      const updatePayload = {
        product: {
          id: linkedProductId,
          variants: [
            {
              inventory_quantity: inventoryQuantity,
            },
          ],
        },
      };

      await axios.put(updateEndpoint, updatePayload, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });
      console.log(`Inventory synchronized for product ${linkedProductId} in shop ${shopDomain}`);
    }

    res.status(200).send('Inventory synchronized across linked products.');
  } catch (error) {
    console.error('Error synchronizing inventory:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
