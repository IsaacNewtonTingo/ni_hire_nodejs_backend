const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BugReportSchema = new Schema({
  whoReported: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  image1: String,
  image2: String,
  image3: String,

  message: String,
  reportDate: Date,
});

exports.BugReport = mongoose.model("BugReport", BugReportSchema);
