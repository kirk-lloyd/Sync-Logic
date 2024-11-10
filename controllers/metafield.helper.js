import axios from 'axios';

export const createOrCheckMetafields = async (shopId, shopDomain, accessToken) => {
  try {
    // Constructing unique namespace using Shop ID
    const namespace = `custom_namespace_${shopId}`;

    // API endpoint for metafields
    const metafieldsUrl = `https://${shopDomain}/admin/api/2023-04/metafields.json`;

    // Check if the metafields already exist
    const response = await axios.get(metafieldsUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
      params: {
        namespace: namespace,
      },
    });

    const existingMetafields = response.data.metafields;

    // Check if 'stock_sync_master' and 'linked_products' metafields already exist
    const hasStockSyncMaster = existingMetafields.some(
      (field) => field.key === 'stock_sync_master'
    );
    const hasLinkedProducts = existingMetafields.some(
      (field) => field.key === 'linked_products'
    );

    if (hasStockSyncMaster && hasLinkedProducts) {
      console.log('Metafields already exist for the store.');
      return; // If both metafields exist, there's nothing more to do
    }

    // Define the metafields we need to create
    const metafieldsToCreate = [];

    if (!hasStockSyncMaster) {
      metafieldsToCreate.push({
        namespace: namespace,
        key: 'stock_sync_master',
        value: 'false',
        type: 'boolean',
        description: 'Marks this product as the sync master to control inventory synchronization',
      });
    }

    if (!hasLinkedProducts) {
      metafieldsToCreate.push({
        namespace: namespace,
        key: 'linked_products',
        value: '[]', // Array to hold linked product IDs
        type: 'json_string',
        description: 'Contains the list of linked products for inventory synchronization controlled by the sync master',
      });
    }

    // Create the missing metafields
    for (const metafield of metafieldsToCreate) {
      await axios.post(metafieldsUrl, { metafield }, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });
      console.log(`Metafield '${metafield.key}' created successfully.`);
    }
  } catch (error) {
    console.error('Error creating or checking metafields:', error);
    throw error; // Raise an error in case of a conflict or failure
  }
};
