import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// MongoDB connection URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://syncUser:StockAdmin2024!$@stock-sync-logic-db.cluster-c1qwo2o0yayj.ap-southeast-2.docdb.amazonaws.com:27017/?tls=true&tlsCAFile=global-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false';

// Path to the CA bundle
const CA_BUNDLE_PATH = path.resolve('./certs/rds-combined-ca-bundle.pem');

export const initializeDatabase = async () => {
  console.log('Starting DocumentDB initialization...');
  try {
    console.log(`Checking CA bundle at path: ${CA_BUNDLE_PATH}`);
    if (fs.existsSync(CA_BUNDLE_PATH)) {
      console.log('CA bundle found.');
    } else {
      console.error('CA bundle not found at specified path.');
      process.exit(1);
    }

    console.log('Attempting to connect to Amazon DocumentDB...');
    await mongoose.connect(MONGODB_URI, {
      tls: true,
      tlsCAFile: CA_BUNDLE_PATH,
      tlsAllowInvalidCertificates: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('Connected successfully to Amazon DocumentDB.');
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
  }
};

// Function to create a unique store connection based on the shop ID
export const createStoreConnection = async (shopId) => {
  try {
    console.log(`Creating unique connection for shopId: ${shopId}`);

    // Construct a unique database name using the shop ID
    const dbName = `sync_logic_${shopId}`;
    const connectionString = `${MONGODB_URI}&dbName=${dbName}`;

    // Create or connect to the unique database
    const connection = await mongoose.createConnection(connectionString, {
      tls: true,
      tlsCAFile: CA_BUNDLE_PATH,
      tlsAllowInvalidCertificates: true,
      serverSelectionTimeoutMS: 5000,
    });

    // Listen for connection events
    connection.on('connected', () => {
      console.log(`Connected successfully to the existing database for shopId: ${shopId}`);
    });

    // This block is an addition to add more confirmation logs
    connection.on('open', () => {
      console.log(`Database for shopId ${shopId} is now open.`);
    });

    // Connection confirmation
    connection.once('open', async () => {
      // Check if the database has collections indicating existing data
      const collections = await connection.db.listCollections().toArray();
      if (collections.length > 0) {
        console.log(`Database for shopId ${shopId} already exists with ${collections.length} collections.`);
      } else {
        console.log(`New database created for shopId ${shopId}. No collections found.`);
      }
    });

    return connection;
  } catch (error) {
    console.error(`Error creating unique connection for shopId ${shopId}:`, error);
    throw error;
  }
};
