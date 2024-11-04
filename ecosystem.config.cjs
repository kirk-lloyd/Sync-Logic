module.exports = {
  apps: [
    {
      name: 'server',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
        SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
        SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
        SHOPIFY_SCOPES: process.env.SHOPIFY_SCOPES,
        MONGODB_URI: process.env.MONGODB_URI,
        TEST_STORE_URL: process.env.TEST_STORE_URL,
        SHOPIFY_APP_HANDLE: process.env.SHOPIFY_APP_HANDLE,
      },
    },
  ],
};
