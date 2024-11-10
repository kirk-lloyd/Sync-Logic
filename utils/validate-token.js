import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const storeName = process.env.TEST_STORE_URL || 'projekt-agency-apps'; // Use the test store from environment or fallback
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;  // Store the actual access token in .env file
const apiVersion = '2023-04';

const validateAccessToken = async () => {
  try {
    const response = await axios.get(`https://${storeName}.myshopify.com/admin/api/${apiVersion}/products.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    });
    console.log('Access Token is valid:', response.status);
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.error('Unauthorized: Access Token is invalid or expired.');
    } else {
      console.error('Error:', error.message);
    }
  }
};

validateAccessToken();
