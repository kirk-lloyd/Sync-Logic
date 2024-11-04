import axios from 'axios';

const storeName = 'projekt-agency-apps';
const accessToken = 'shpua_2808d7d586bc6db8b60eff289f6cb771';  // Replace with your actual access token
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
