const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CategorySchema = new Schema({
  categoryName: String,
});

exports.Category = mongoose.model("Category", CategorySchema);
