import mongoose from 'mongoose';

const storeSchema = new mongoose.Schema({
  store_id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // Auto-generate ObjectId
  shop_domain: { type: String, required: true },
  access_token: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const Store = mongoose.model('Store', storeSchema);
export default Store;
