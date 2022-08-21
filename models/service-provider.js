const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ServiceProviderSchema = new Schema({
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
  },
  description: String,
  image1: String,
  image2: String,
  image3: String,
  rate: Number,
  rating: Number,
  isPromoted: Boolean,
  datePromoted: Date,

  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  savedBy: [String],
  serviceViewedBy: [String],
});

exports.ServiceProvider = mongoose.model(
  "ServiceProvider",
  ServiceProviderSchema
);
