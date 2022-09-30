const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ServiceProviderSchema = new Schema({
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
  },
  description: String,
  image1: String,
  image2: String,
  image3: String,
  rate: Number,
  rating: Number,
  isPromoted: Boolean,
  datePromoted: Date,
  dateCreated: Date,

  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

exports.ServiceProvider = mongoose.model(
  "ServiceProvider",
  ServiceProviderSchema
);
