import dotenv from 'dotenv';
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './db/connect.js';
import Store from './models/store.model.js';
import productRoutes from './routes/product.routes.js';
import storeRoutes from './routes/store.routes.js';

dotenv.config();

// Create __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting server initialization...');

// Initialize the PostgreSQL database connection
initializeDatabase()
  .then(() => {
    console.log('Database initialization complete.');
  })
  .catch((error) => {
    console.error('Error during database initialization:', error);
  });

const app = express();
const port = process.env.PORT || 5000;

// Shopify credentials from environment variables
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

// Middleware setup
console.log('Setting up middleware...');

// Body Parser to parse JSON requests
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
console.log('Body parser setup complete.');

// Cookie Parser to manage cookies
app.use(cookieParser());
console.log('Cookie parser setup complete.');

// Express Session for session management
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    },
  })
);
console.log('Session middleware setup complete.');

// Middleware to verify Shopify-embedded app request
app.use('/app', (req, res, next) => {
  const { shop, hmac } = req.query;

  if (!shop || !hmac) {
    console.error('Access denied: missing shop or hmac parameters');
    return res.status(403).send('Access denied. Missing shop or hmac parameters.');
  }

  // Verify HMAC to ensure the request is valid
  const query = Object.keys(req.query)
    .filter((key) => key !== 'hmac' && key !== 'signature')
    .sort()
    .map((key) => `${key}=${req.query[key]}`)
    .join('&');

  const generatedHmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(query)
    .digest('hex');

  if (generatedHmac !== hmac) {
    console.error('Access denied: HMAC validation failed.');
    return res.status(403).send('Access denied. Invalid HMAC.');
  }

  console.log('Shopify HMAC validation successful.');
  next();
});
console.log('Shopify verification middleware setup complete.');

// Log every incoming request
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Use imported routes
app.use('/api/products', productRoutes);
app.use('/api/stores', storeRoutes);

// Serve static files from the React app (new setup)
console.log("Serving static files from the 'frontend/build' directory.");
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Serve React App for any unknown routes (fallback route)
app.get('*', (req, res) => {
  console.log('Fallback route triggered, serving React app...');
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
