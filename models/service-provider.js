const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ServiceProviderSchema = new Schema({
  serviceName: String,
  serviceID: String,
  serviceCategoryName: String,
  serviceCategoryID: String,
  description: String,
  image1: String,
  image2: String,
  image3: String,
  rate: Number,
  rating: Number,
  isPromoted: Boolean,
  datePromoted: Date,

  providerFirstName: String,
  providerLastName: String,
  providerPhoneNumber: Number,
  providerEmail: String,
  providerUserID: String,
  providerLocation: String,

  savedBy: [String],
  serviceViewedBy: [String],
});

exports.ServiceProvider = mongoose.model(
  "ServiceProvider",
  ServiceProviderSchema
);
