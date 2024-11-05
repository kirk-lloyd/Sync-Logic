// queryStore.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sync-logic-db';

const storeSchema = new mongoose.Schema({
  shop_domain: String,
  access_token: String
});

const Store = mongoose.model('Store', storeSchema);

async function queryStore() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const store = await Store.findOne({ shop_domain: 'projekt-agency-apps.myshopify.com' });
    console.log('Store Document:', store);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error querying MongoDB:', error);
  }
}

queryStore();
