const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ViewedServiceProvidersSchema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceProvider",
  },
  dateViewed: Date,
});

exports.MyViewedServiceProvider = mongoose.model(
  "MyViewedServiceProvider",
  ViewedServiceProvidersSchema
);
