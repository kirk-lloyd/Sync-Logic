import axios from 'axios';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { createOrCheckMetafields } from './metafield.helper.js';
import { createOrConnectStoreDatabase } from '../middlewares/shopify.middleware.js';

export const handleOAuthCallback = async (req, res) => {
  const { shop, code } = req.query;

  try {
    // Request the access token from Shopify
    const accessTokenRequestUrl = `https://${shop}/admin/oauth/access_token`;
    const accessTokenPayload = {
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    };
    const response = await axios.post(accessTokenRequestUrl, accessTokenPayload);
    const accessToken = response.data.access_token;

    // Use the access token to get store details, including Shop ID
    const shopDetailsUrl = `https://${shop}/admin/api/2023-04/shop.json`;
    const shopDetailsResponse = await axios.get(shopDetailsUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    });
    const shopDetails = shopDetailsResponse.data.shop;
    const shopId = shopDetails.id; // Unique, immutable identifier for the store
    const shopDomain = shopDetails.domain; // Store domain

    // Create or connect to the unique database for this store using shopId
    const dbConnection = await createOrConnectStoreDatabase(shopId);

    // Save the store information in the database
    const StoreModel = dbConnection.model('Store', new mongoose.Schema({
      shop_id: { type: String, unique: true },
      shop_domain: String,
      access_token: String,
      created_at: { type: Date, default: Date.now },
    }));

    await StoreModel.findOneAndUpdate(
      { shop_id: shopId },
      { shop_domain: shopDomain, access_token: accessToken },
      { upsert: true, new: true }
    );

    console.log(`Successfully registered store with Shop ID: ${shopId}`);

    // Create or check metafields for stock sync
    await createOrCheckMetafields(shopId, shopDomain, accessToken);

    res.redirect(`https://${shop}/admin/apps/${process.env.SHOPIFY_APP_HANDLE}`);
  } catch (error) {
    console.error(`Error handling OAuth callback for ${shop}:`, error);
    res.status(500).send('Internal Server Error');
  }
};
export const handleAppUninstall = async (req, res) => {
  const shopDomain = req.headers['x-shopify-shop-domain'];
  if (!shopDomain) {
    console.error("Shop domain missing in request headers for app uninstall");
    return res.status(400).send("Shop domain missing in request headers");
  }

  try {
    const StoreModel = req.dbConnection.model('Store', new mongoose.Schema({
      shop_domain: String,
      access_token: String,
      created_at: { type: Date, default: Date.now },
    }));

    await StoreModel.findOneAndDelete({ shop_domain: shopDomain });
    console.log(`Data for ${shopDomain} removed upon app uninstall`);
    res.status(200).send("App uninstalled");
  } catch (error) {
    console.error("Error handling app/uninstalled webhook:", error.message);
    res.status(500).send("Internal Server Error");
  }
};
