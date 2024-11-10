import { createStoreConnection } from '../db/connect.js';

async function queryStore(shopDomain) {
  try {
    console.log('Starting query to MongoDB...');
    
    const dbConnection = await createStoreConnection(shopDomain);

    const StoreModel = dbConnection.model('Store', new mongoose.Schema({ shop_domain: String, access_token: String }));
    const store = await StoreModel.findOne({ shop_domain: shopDomain });

    console.log('Store Document:', store);
    await dbConnection.close(); // Disconnect after use
  } catch (error) {
    console.error('Error querying MongoDB:', error);
  }
}

queryStore('projekt-agency-apps.myshopify.com');
