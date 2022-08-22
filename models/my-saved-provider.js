const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SavedServiceProvidersSchema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceProvider",
  },
  dateSaved: Date,
});

exports.MySavedServiceProvider = mongoose.model(
  "MySavedServiceProvider",
  SavedServiceProvidersSchema
);
