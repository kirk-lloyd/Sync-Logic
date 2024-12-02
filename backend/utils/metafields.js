// Path: /home/ec2-user/stock-sync-logic/backend/utils/metafields.js

import fetch from 'node-fetch';
import fs from 'fs';

const NAMESPACE = 'custom';
const STOCK_SYNC_MASTER_KEY = 'stock_sync_master';
const LINKED_PRODUCTS_KEY = 'linked_products';

const logToFile = (message) => {
    const logMessage = `${new Date().toISOString()} - ${message}\n`;
    fs.appendFile('/home/ec2-user/stock-sync-logic/backend/logs/metafields.log', logMessage, (err) => {
        if (err) console.error('Failed to write log:', err);
    });
};

const fetchWithRetry = async (url, options, retries = 3) => {
    try {
        logToFile(`Attempting request to ${url}`);
        const response = await fetch(url, options);
        if (response.status === 429 && retries > 0) {
            logToFile('Rate limit reached, retrying request...');
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for 2 seconds
            return fetchWithRetry(url, options, retries - 1);
        }
        return response;
    } catch (error) {
        logToFile(`Request failed with error: ${error.message}`);
        throw error;
    }
};

export const createSingleMetafieldDefinition = async (shop, accessToken, definition) => {
    const url = `https://${shop}/admin/api/2023-07/graphql.json`;

    const query = `
        mutation {
            metafieldDefinitionCreate(definition: ${JSON.stringify(definition)}) {
                metafieldDefinition {
                    id
                }
                userErrors {
                    field
                    message
                }
            }
        }
    `;

    try {
        logToFile(`Attempting to create metafield definition: ${definition.key}`);
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
            },
            body: JSON.stringify({ query }),
        });

        const responseBody = await response.json();
        if (responseBody.errors) {
            logToFile(`Errors occurred during metafield creation: ${JSON.stringify(responseBody.errors)}`);
        } else if (responseBody.data) {
            const { metafieldDefinitionCreate } = responseBody.data;
            if (metafieldDefinitionCreate.userErrors.length > 0) {
                metafieldDefinitionCreate.userErrors.forEach((error) => {
                    logToFile(`Error in field '${error.field}': ${error.message}`);
                });
            } else {
                logToFile(`Metafield definition created successfully: ${metafieldDefinitionCreate.metafieldDefinition.id}`);
            }
        } else {
            logToFile(`Unexpected response during metafield creation: ${JSON.stringify(responseBody)}`);
        }
    } catch (error) {
        logToFile(`Metafield creation request failed with error: ${error.message}`);
    }
};

export const checkAndCreateMetafieldDefinitions = async (shop, accessToken) => {
    const url = `https://${shop}/admin/api/2023-07/graphql.json`;

    const query = `
        {
            metafieldDefinitions(first: 50, ownerType: PRODUCT) {
                edges {
                    node {
                        namespace
                        key
                        id
                    }
                }
            }
        }
    `;

    try {
        logToFile(`Checking for existing metafield definitions for shop: ${shop}`);
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
            },
            body: JSON.stringify({ query }),
        });

        const responseBody = await response.json();
        if (responseBody.errors) {
            logToFile(`Errors occurred while checking metafields: ${JSON.stringify(responseBody.errors)}`);
            return;
        }

        const existingDefinitions = responseBody.data.metafieldDefinitions.edges;
        const stockSyncMasterExists = existingDefinitions.some(
            (def) => def.node.namespace === NAMESPACE && def.node.key === STOCK_SYNC_MASTER_KEY
        );
        const linkedProductsExists = existingDefinitions.some(
            (def) => def.node.namespace === NAMESPACE && def.node.key === LINKED_PRODUCTS_KEY
        );

        if (!stockSyncMasterExists || !linkedProductsExists) {
            logToFile('Metafield definitions missing, creating now...');
            const definitions = [
                {
                    name: 'Stock Sync Master',
                    namespace: NAMESPACE,
                    key: STOCK_SYNC_MASTER_KEY,
                    description: 'Indicates if the product is the master for inventory synchronization',
                    type: 'BOOLEAN',
                    ownerType: 'PRODUCT'
                },
                {
                    name: 'Linked Products',
                    namespace: NAMESPACE,
                    key: LINKED_PRODUCTS_KEY,
                    description: 'References linked child products',
                    type: 'LIST_PRODUCT_REFERENCE',
                    ownerType: 'PRODUCT'
                }
            ];

            await Promise.all(definitions.map(def => createSingleMetafieldDefinition(shop, accessToken, def)));
        } else {
            logToFile('Metafield definitions already exist. No action needed.');
        }
    } catch (error) {
        logToFile(`Request failed while checking metafields: ${error.message}`);
    }
};
