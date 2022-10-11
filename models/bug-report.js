const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BugReportSchema = new Schema({
  whoReported: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  message: String,
  reportDate: Date,
});

exports.BugReport = mongoose.model("BugReport", BugReportSchema);
