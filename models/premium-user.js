const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PremiumUserSchema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  datePromoted: Date,
  dateExpiring: Date,
});

exports.PremiumUser = mongoose.Model("PremiumUser", PremiumUserSchema);
