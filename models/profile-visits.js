const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProfileVisitSchema = new Schema({
  whoVisited: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  whoWasVisited: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  dateVisited: Date,
});

exports.ProfileVisit = mongoose.model("ProfileVisit", ProfileVisitSchema);
