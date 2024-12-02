// backend/utils/storeUtils.js
import fetch from 'node-fetch';

export const getShopifyStoreID = async (shop, accessToken) => {
  const url = `https://${shop}/admin/api/2023-07/graphql.json`;

  const query = `
    {
      shop {
        id
      }
    }
  `;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query }),
    });

    const responseBody = await response.json();
    if (responseBody.errors) {
      console.error('Error fetching shop ID:', responseBody.errors);
      throw new Error('Failed to fetch shop ID');
    }

    return responseBody.data.shop.id;
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
};
