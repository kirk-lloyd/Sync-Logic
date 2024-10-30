import mongoose from 'mongoose';

const bundleSchema = new mongoose.Schema({
  // Auto-generate _id by MongoDB for each bundle instead of defining bundle_id manually
  store_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  master_product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  linked_product_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const Bundle = mongoose.model('Bundle', bundleSchema);
export default Bundle;
