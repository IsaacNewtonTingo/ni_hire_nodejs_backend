const express = require("express");
const { Category } = require("../models/add-category");
const { Service } = require("../models/add-service");
const { ServiceProvider } = require("../models/service-provider");
const User = require("../models/user");
const router = express.Router();

router.post("/add-service", async (req, res) => {
  const {
    service,
    category,
    description,
    image1,
    image2,
    image3,
    rate,
    provider,
  } = req.body;

  if (!service) {
    res.json({
      status: "Failed",
      message: "Service ID is missing",
    });
  } else if (!category) {
    res.json({
      status: "Failed",
      message: "Category ID is missing",
    });
  } else if (!description) {
    res.json({
      status: "Failed",
      message: "Please input a description",
    });
  } else if (!rate) {
    res.json({
      status: "Failed",
      message: "Please input your rate",
    });
  } else if (!provider) {
    res.json({
      status: "Failed",
      message: "Service provider user ID is missing",
    });
  } else {
    //check if user exists
    await User.find({ _id: provider })
      .then(async (response) => {
        if (response.length > 0) {
          //User is found
          //Check if Id is valid
          if (category.match(/^[0-9a-fA-F]{24}$/)) {
            //Check if category exists
            await Category.findById(category)
              .then(async (response) => {
                if (response) {
                  //category exists
                  //Check if Id is valid
                  if (service.match(/^[0-9a-fA-F]{24}$/)) {
                    //check if service exists

                    await Service.findById(service).then(async (response) => {
                      if (response) {
                        //save to db

                        const newServiceProvider = ServiceProvider({
                          service,
                          category,
                          description,
                          image1,
                          image2,
                          image3,
                          rate: parseInt(rate.replace(/,/g, "")),
                          rating: 0,
                          isPromoted: false,
                          datePromoted: "",
                          provider,
                          savedBy: [],
                          serviceViewedBy: [],
                        });

                        await newServiceProvider
                          .save()
                          .then((response) => {
                            res.json({
                              status: "Success",
                              message: "Successfully posted",
                              data: response,
                            });
                          })
                          .catch((err) => {
                            console.log(err);
                            res.json({
                              status: "Failed",
                              message: "Error occured while posting service",
                            });
                          });
                      } else {
                        //service not found
                        res.json({
                          status: "Failed",
                          message: "Service not found",
                        });
                      }
                    });
                  } else {
                    //id not valid
                    res.json({
                      status: "Failed",
                      message: "ServiceID not valid",
                    });
                  }
                } else {
                  //category doesn't exist
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
            //Id not valid
            res.json({
              status: "Failed",
              message: "CategoryID not valid",
            });
          }
        } else {
          //User not found
          res.json({
            status: "Failed",
            message: "User not found",
          });
        }
      })
      .catch((err) => {
        console.log(err);
        res.json({
          status: "Failed",
          message: "Error occured while finding user",
        });
      });
  }
});

router.get("/get-all-service-providers", async (req, res) => {
  const serviceProviders = await ServiceProvider.find({})
    .populate("service")
    .populate("category")
    .populate("provider");

  // const serviceProviderCount = await ServiceProvider.countDocuments();

  res.json({
    serviceProviders: serviceProviders.map((serviceProviders) => ({
      rate: serviceProviders.rate,
      service: serviceProviders.service,
      category: serviceProviders.category,
      description: serviceProviders.description,
      image1: serviceProviders.image1,
      image2: serviceProviders.image2,
      image3: serviceProviders.image3,
      rating: serviceProviders.rating,
      isPromoted: serviceProviders.isPromoted,
      datePromoted: serviceProviders.datePromoted,
      provider: serviceProviders.provider,
      savedBy: serviceProviders.savedBy,
      serviceViewedBy: serviceProviders.serviceViewedBy,
    })),
    // serviceProviderCount,
  });
});

module.exports = router;
