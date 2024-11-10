import mongoose from 'mongoose';

const { Schema } = mongoose;

const storeSchema = new Schema({
  shop_domain: {
    type: String,
    required: true,
    unique: true
  },
  access_token: {
    type: String,
    required: true
  }
});

const Store = mongoose.model('Store', storeSchema);
export default Store;
