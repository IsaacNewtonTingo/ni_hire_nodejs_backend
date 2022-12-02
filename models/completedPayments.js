const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CompletedPaymentSchema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  amountPaid: Number,
  accountNumber: String,
  dateOfPayment: Date,
  dateVerified: Date,
});

const CompletedPayment = mongoose.model(
  "CompletedPayment",
  CompletedPaymentSchema
);
module.exports = CompletedPayment;
