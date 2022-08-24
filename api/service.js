const express = require("express");
const router = express.Router();

const { Category } = require("../models/category");
const { Service } = require("../models/service");
const { ServiceProvider } = require("../models/service-provider");

//add service
router.post("/post-service", async (req, res) => {
  const { serviceName, categoryID } = req.body;

  if (!serviceName) {
    res.json({
      status: "Failed",
      message: "Service is missing",
    });
  } else if (!categoryID) {
    res.json({
      status: "Failed",
      message: "Category is missing",
    });
  } else {
    //validate id
    if (categoryID.match(/^[0-9a-fA-F]{24}$/)) {
      // Yes, it's a valid ObjectId, proceed with `findById` call.
      await Category.findById(categoryID)
        .then(async (response) => {
          if (response) {
            //category is present
            //Add service to db
            const newService = new Service({
              serviceName,
              categoryID,
              serviceProviders: [],
            });

            await newService
              .save()
              .then((response) => {
                res.json({
                  status: "Success",
                  message: "Service added successfully",
                  data: response,
                });
              })
              .catch((err) => {
                console.log(err);
                res.json({
                  status: "Failed",
                  message: "Error occured while saving service",
                });
              });
          } else {
            //Category not found
            res.json({
              status: "Failed",
              message: "Category not found",
            });
          }
        })
        .catch((err) => {
          console.log(err);
          res.json({
            status: "Failed",
            message: "Error occured while checking category status",
          });
        });
    } else {
      res.json({
        status: "Failed",
        message: "Invalid ID",
      });
    }
  }
});

//get all services
router.get("/get-all-services", async (req, res) => {
  const services = await Service.find({});

  res.send(services);
});

//get services in a given category
router.get("/get-services/:id", async (req, res) => {
  const categoryID = req.params.id;
  if (categoryID.match(/^[0-9a-fA-F]{24}$/)) {
    await Service.find({ categoryID: categoryID })
      .then((response) => {
        if (response.length <= 0) {
          res.json({
            status: "Failed",
            message: "No services found",
          });
        } else {
          res.json({
            status: "Success",
            message: "Services found",
            data: response,
          });
        }
      })
      .catch((err) => {
        console.log(err);
        res.json({
          status: "Failed",
          message: "Error occured while getting category",
        });
      });
  } else {
    res.json({
      status: "Failed",
      message: "Invalid category ID",
    });
  }
});

//get popular services
router.get("/popular-services", async (req, res) => {
  const services = await Service.find({})
    .sort({ serviceProviders: -1 })
    .limit(4);
  res.send(services);
});

//search a service
router.get("/search-service", async (req, res) => {
  const { serviceName } = req.query;

  if (!serviceName.trim()) {
    res.json({
      status: "Failed",
      message: "Please input a service to search",
    });
  } else {
    await Service.find({ serviceName: { $regex: serviceName, $options: "i" } })
      .then((response) => {
        if (response.length > 0) {
          res.send(response);
        } else {
          res.json({
            status: "Failed",
            message: "No data found",
          });
        }
      })
      .catch((err) => {
        console.log(err);
        res.json({
          status: "Failed",
          message: "Error occured while searching service",
        });
      });
  }
});

router.get("/filter-search", async (req, res) => {
  const { serviceName, location } = req.query;

  if (!serviceName.trim()) {
    res.json({
      status: "Failed",
      message: "Please input a service to search",
    });
  } else {
    const servers = await ServiceProvider.find({})
      .populate("service")
      .populate("provider")
      .catch((err) => {
        console.log(err);
        res.json({
          status: "Failed",
          message: "Error occured while searching service",
        });
      });

    let filteredServiceProviders = servers.filter(function (servers) {
      if (
        servers.service.serviceName == serviceName &&
        servers.provider.location == location
      ) {
        return true;
      }
    });

    res.send(filteredServiceProviders);

    // res.send(
    //   servers.filter((servers) => servers.service.serviceName == serviceName)
    // );
  }
});

module.exports = router;
