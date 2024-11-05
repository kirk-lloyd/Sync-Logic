import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sync-logic-db';

const storeSchema = new mongoose.Schema({
  shop_domain: String,
  access_token: String
});

const Store = mongoose.model('Store', storeSchema);

async function testUpdate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const testData = { shop_domain: 'test-shop.myshopify.com', access_token: 'test-access-token' };
    const result = await Store.findOneAndUpdate(
      { shop_domain: testData.shop_domain },
      testData,
      { upsert: true, new: true }
    );

    console.log('Test update result:', result);
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error in test update:', error);
  }
}

testUpdate();
