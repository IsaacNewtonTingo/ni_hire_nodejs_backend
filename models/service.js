const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ServiceSchema = new Schema({
  serviceName: String,
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
  },
  serviceProviders: [String],
});

exports.Service = mongoose.model("Service", ServiceSchema);
