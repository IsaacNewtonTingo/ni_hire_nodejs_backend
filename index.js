const express = require("express");
const bodyParser = require("body-parser").json;
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser());

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});

require("./config/db");

const UserRouter = require("./api/user");
const CategoryRouter = require("./api/category");
const ServiceRouter = require("./api/service");
const ServiceProviderRouter = require("./api/service-provider");

app.use("/user", UserRouter);
app.use("/user/service-provider", ServiceProviderRouter);
app.use("/user/admin", CategoryRouter, ServiceRouter);
