const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ServiceProviderSchema = new Schema({
  serviceID: {
    Type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
  },
  serviceCategoryID: {
    Type: mongoose.Schema.Types.ObjectId,
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

  providerUserID: {
    Type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  savedBy: [String],
  serviceViewedBy: [String],
});

exports.ServiceProvider = mongoose.model(
  "ServiceProvider",
  ServiceProviderSchema
);
