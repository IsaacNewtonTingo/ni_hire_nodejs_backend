const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PromotedUserSchema = new Schema({
  userID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  phoneNumber: Number,
  amountPaid: Number,
  datePromoted: Date,
  expiryDate: Date,
});

exports.PromotedUser = mongoose.model("PromotedUser", PromotedUserSchema);
