import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Store from './models/store.model.js';
import Product from './models/product.model.js';
import Bundle from './models/bundle.model.js';

// Load environment variables
dotenv.config();

// Debugging to verify MONGODB_URI is being read correctly
console.log('MONGODB_URI:', process.env.MONGODB_URI);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected for seeding'))
  .catch(err => console.error('MongoDB connection error:', err));

const seedData = async () => {
  try {
    // Clear existing data
    await Store.deleteMany({});
    await Product.deleteMany({});
    await Bundle.deleteMany({});

    // Create sample store
    const store = await Store.create({
      shop_domain: "example.myshopify.com",
      access_token: "sample_access_token"
    });

    // Check that store is successfully created and log its ID
    console.log('Created Store ID:', store._id);

    // Create sample products, using the store's _id
    const product1 = await Product.create({
      store_id: store._id,
      title: "Sample Product 1",
      sku: "SP001",
      inventory_quantity: 100,
      is_sync_master: true,
      product_type: "Sample Type",
      vendor: "Sample Vendor"
    });

    const product2 = await Product.create({
      store_id: store._id,
      title: "Sample Product 2",
      sku: "SP002",
      inventory_quantity: 50,
      is_sync_master: false,
      product_type: "Sample Type",
      vendor: "Sample Vendor"
    });

    // Create sample bundle, using the store's _id and product IDs
    await Bundle.create({
      store_id: store._id,
      master_product_id: product1._id,
      linked_product_ids: [product2._id]
    });

    console.log('Seeding completed successfully');
    process.exit();
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
};

seedData();
