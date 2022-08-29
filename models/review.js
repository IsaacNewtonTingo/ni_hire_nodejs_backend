const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ReviewSchema = new Schema({
  whoReviewed: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  serviceReviewed: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceProvider",
  },
  createdAt: Date,
  reviewMessage: String,
  rating: Number,
});

exports.Review = mongoose.model("Review", ReviewSchema);
