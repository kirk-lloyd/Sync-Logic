import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// MongoDB connection URI
const MONGODB_URI = 'mongodb://syncUser:StockAdmin2024!$@stock-sync-logic-db.cluster-c1qwo2o0yayj.ap-southeast-2.docdb.amazonaws.com:27017/?tls=true&tlsCAFile=global-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false';

// Path to the CA bundle
const CA_BUNDLE_PATH = path.resolve('./certs/rds-combined-ca-bundle.pem');

(async function testConnection() {
  console.log('Starting DocumentDB connection test...');

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
      tlsAllowInvalidCertificates: true,  // Added to allow invalid/self-signed certificates
      serverSelectionTimeoutMS: 5000,
    });

    console.log('Successfully connected to Amazon DocumentDB.');
  } catch (error) {
    console.error('Error during DocumentDB connection:', error.message);
    console.error('Full error:', error);
  } finally {
    // Disconnect if connected
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('Disconnected from Amazon DocumentDB.');
    } else {
      console.log('No active connection to disconnect.');
    }
  }
})();
