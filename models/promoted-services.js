const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PromotedServicesSchema = new Schema({
  userID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  promotedService: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceProvider",
  },
  phoneNumber: Number,
  amountPaid: Number,
  datePromoted: Date,
  expiryDate: Date,
});

exports.PromotedService = mongoose.model(
  "PromotedService",
  PromotedServicesSchema
);
