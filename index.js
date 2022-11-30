const express = require("express");
const bodyParser = require("body-parser").json;
const cors = require("cors");
var http = require("http");
require("dotenv").config();

setInterval(function () {
  http.get("http://ni-hire-backend.herokuapp.com/");
}, 300000);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser());

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});

require("./config/db");
require("./api/auto-update-records");

const UserRouter = require("./api/user");
const CategoryRouter = require("./api/category");
const ServiceRouter = require("./api/service");
const ServiceProviderRouter = require("./api/service-provider");

app.use("/user", UserRouter);
app.use("/app/service-provider", ServiceProviderRouter);
app.use("/app/service", CategoryRouter, ServiceRouter);
