import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // Auto-generated ObjectId
  store_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  title: { type: String, required: true },
  sku: { type: String, required: true },
  inventory_quantity: { type: Number, required: true },
  is_sync_master: { type: Boolean, default: false },
  product_type: { type: String },
  vendor: { type: String },
}, { timestamps: true }); // Added timestamps

const Product = mongoose.model('Product', productSchema);
export default Product;
