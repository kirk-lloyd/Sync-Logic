// Import necessary libraries
import express from 'express';
import { useStoreDatabase } from '../middlewares/shopify.middleware.js';
import Store from '../models/store.model.js';

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
        const accessTokenDoc = await req.storeDb.collection('store_tokens').findOne({ shop_domain: shopDomain });

        if (!accessTokenDoc || !accessTokenDoc.access_token) {
            console.error('No access token found for shop:', shopDomain);
            return res.status(401).send('Unauthorized: Access token missing');
        }

        const accessToken = accessTokenDoc.access_token;
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

export default router;
