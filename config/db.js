const mongoose = require("mongoose");
require("dotenv").config();

mongoose
  .connect(process.env.MONGO_URL)
  .catch((err) => {
    console.log(err);
  })
  .then(() => {
    console.log("DB connected");
  });
