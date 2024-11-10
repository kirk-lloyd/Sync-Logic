import mongoose from 'mongoose';

const bundleSchema = new mongoose.Schema({
  store_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  master_product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  linked_product_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { timestamps: true }); // Added timestamps

// Add timestamps option to automatically manage created_at and updated_at fields
const Bundle = mongoose.model('Bundle', bundleSchema);
export default Bundle;
