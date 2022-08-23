const express = require("express");
const router = express.Router();

const User = require("../models/user");
const { MySavedServiceProvider } = require("../models/my-saved-provider");
const { MyViewedServiceProvider } = require("../models/my-viewed-providers");
const { Service } = require("../models/service");
const { ServiceProvider } = require("../models/service-provider");

router.post("/add-service", async (req, res) => {
  const { service, description, image1, image2, image3, rate, provider } =
    req.body;

  if (!service) {
    res.json({
      status: "Failed",
      message: "Service is missing",
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
          if (service.match(/^[0-9a-fA-F]{24}$/)) {
            await Service.findById(service)
              .then(async (response) => {
                if (response) {
                  const newServiceProvider = ServiceProvider({
                    service,
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

                  await Service.updateOne(
                    { _id: service },
                    { $push: { serviceProviders: provider } }
                  ).catch((err) => {
                    console.log(err);
                  });
                } else {
                  res.json({
                    status: "Failed",
                    message: "Service not found",
                  });
                }
              })
              .catch((err) => {
                console.log(err);
                res.json({
                  status: "Failed",
                  message: "Error occured while finding service",
                });
              });
          } else {
            res.json({
              status: "Failed",
              message: "ServiceID not valid",
            });
          }
        } else {
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

//Get all service providers
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
      id: serviceProviders._id,
    })),
    // serviceProviderCount,
  });
});

//Get a specific service provider
router.get("/get-one-service-provider/:id", async (req, res) => {
  const serviceProviderID = req.params.id;
  if (serviceProviderID.match(/^[0-9a-fA-F]{24}$/)) {
    //valid ID
    const serviceProvider = await ServiceProvider.findById(serviceProviderID)
      .populate("service")
      .populate("category")
      .populate("provider")
      .catch((err) => {
        console.log(err);
      });

    if (!serviceProvider) {
      res.json({
        status: "Failed",
        message: "Service provider not found",
      });
    } else {
      res.send(serviceProvider);
    }
  } else {
    //not valid ID
    res.json({
      status: "Failed",
      message: "Invalid service provider ID",
    });
  }
});

//Get all service providers in a given category
router.get("/category/get-all-service-providers/:id", async (req, res) => {
  const categoryID = req.params.id;

  if (categoryID.match(/^[0-9a-fA-F]{24}$/)) {
    const serviceProviders = await ServiceProvider.find({
      category: categoryID,
    })
      .populate("service")
      .populate("category")
      .populate("provider")
      .catch((err) => {
        console.log(err);
        res.json({
          status: "Failed",
          message: "Error occured while getting data",
        });
      });

    if (serviceProviders.length <= 0) {
      res.json({
        status: "Failed",
        message: "No data found for the given category",
      });
    } else {
      res.send(serviceProviders);
    }
  } else {
    res.json({
      status: "Failed",
      message: "Invalid categoy ID",
    });
  }
});

//Get featured service providers
router.get("/get-featured", async (req, res) => {
  await ServiceProvider.find({ isPromoted: true })
    .populate("service")
    .populate("category")
    .populate("provider")
    .then((response) => {
      res.send(response);
    })
    .catch((err) => {
      console.log(err);
      res.json({
        status: "Failed",
        message: "Error occured while getting featured service provider",
      });
    });
});

//Add to viewed by
router.post("/add-viewed-by", async (req, res) => {
  const { serviceProviderID, userID } = req.body;
  if (!serviceProviderID) {
    res.json({
      status: "Failed",
      message: "Service provider ID is missing",
    });
  } else if (!userID) {
    res.json({
      status: "Failed",
      message: "User ID is missing",
    });
  } else {
    //check if user id is valid
    await User.findOne({ _id: userID })
      .then(async (response) => {
        if (response) {
          //check if service provider exists
          await ServiceProvider.findOne({ _id: serviceProviderID })
            .then(async (response) => {
              if (response) {
                //check if they already viewed
                await MyViewedServiceProvider.find({
                  $and: [{ user: userID }, { provider: serviceProviderID }],
                })
                  .then(async (response) => {
                    const newMyViewedServiceProvider =
                      new MyViewedServiceProvider({
                        user: userID,
                        provider: serviceProviderID,
                        dateViewed: Date.now() + 10800000,
                      });

                    if (response.length > 0) {
                      //already viewed
                      await MyViewedServiceProvider.deleteOne({
                        $and: [
                          { user: userID },
                          { provider: serviceProviderID },
                        ],
                      })
                        .then(async () => {
                          await newMyViewedServiceProvider
                            .save()
                            .then(() => {
                              res.json({
                                status: "Success",
                                message:
                                  "Successfully added to my viewed service provider",
                              });
                            })
                            .catch((err) => {
                              console.log(err);
                              res.json({
                                status: "Failed",
                                message:
                                  "Error occured while saving my viewed service provider",
                              });
                            });
                        })
                        .catch((err) => {
                          console.log(err);
                          res.json({
                            status: "Failed",
                            message:
                              "Error occured while deleting existing my viewed service provider",
                          });
                        });
                    } else {
                      //not viewed
                      await newMyViewedServiceProvider
                        .save()
                        .then(() => {
                          res.json({
                            status: "Success",
                            message:
                              "Successfully added to my viewed service provider",
                          });
                        })
                        .catch((err) => {
                          console.log(err);
                          res.json({
                            status: "Failed",
                            message:
                              "Error occured while saving my viewed service provider",
                          });
                        });
                    }
                  })
                  .catch((err) => {
                    console.log(err);
                    res.json({
                      status: "Failed",
                      message:
                        "Error occured while checking existing views records",
                    });
                  });
              } else {
                res.json({
                  status: "Failed",
                  message: "Service provider not found",
                });
              }
            })
            .catch((err) => {
              console.log(err);
              res.json({
                status: "Failed",
                message: "Error occured while checking service provider",
              });
            });
        } else {
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
          message: "Error occured while checking user data",
        });
      });
  }
});

//Add to saved by
router.post("/save-post", async (req, res) => {
  const { serviceProviderID, userID } = req.body;
  if (!serviceProviderID) {
    res.json({
      status: "Failed",
      message: "Service provider ID is missing",
    });
  } else if (!userID) {
    res.json({
      status: "Failed",
      message: "User ID is missing",
    });
  } else {
    //check if user id is valid
    await User.findOne({ _id: userID })
      .then(async (response) => {
        if (response) {
          //check if service provider exists
          await ServiceProvider.findOne({ _id: serviceProviderID })
            .then(async (response) => {
              if (response) {
                //check if they already saved
                await MySavedServiceProvider.find({
                  $and: [{ user: userID }, { provider: serviceProviderID }],
                })
                  .then(async (response) => {
                    const newMySavedServiceProvider =
                      new MySavedServiceProvider({
                        user: userID,
                        provider: serviceProviderID,
                        dateSaved: Date.now() + 10800000,
                      });

                    if (response.length > 0) {
                      //already saved
                      await MySavedServiceProvider.deleteOne({
                        $and: [
                          { user: userID },
                          { provider: serviceProviderID },
                        ],
                      })
                        .then(async () => {
                          await newMySavedServiceProvider
                            .save()
                            .then(() => {
                              res.json({
                                status: "Success",
                                message: "Successfully saved",
                              });
                            })
                            .catch((err) => {
                              console.log(err);
                              res.json({
                                status: "Failed",
                                message: "Error occured while saving",
                              });
                            });
                        })
                        .catch((err) => {
                          console.log(err);
                          res.json({
                            status: "Failed",
                            message:
                              "Error occured while deleting existing my viewed service provider",
                          });
                        });
                    } else {
                      //not saved
                      await newMySavedServiceProvider
                        .save()
                        .then(() => {
                          res.json({
                            status: "Success",
                            message: "Successfully saved",
                          });
                        })
                        .catch((err) => {
                          console.log(err);
                          res.json({
                            status: "Failed",
                            message: "Error occured while saving",
                          });
                        });
                    }
                  })
                  .catch((err) => {
                    console.log(err);
                    res.json({
                      status: "Failed",
                      message:
                        "Error occured while checking existing saved records",
                    });
                  });
              } else {
                res.json({
                  status: "Failed",
                  message: "Service provider not found",
                });
              }
            })
            .catch((err) => {
              console.log(err);
              res.json({
                status: "Failed",
                message: "Error occured while checking service provider",
              });
            });
        } else {
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
          message: "Error occured while checking user data",
        });
      });
  }
});

//Get recently viewed
router.get("/recently-viewed", async (req, res) => {
  const { userID } = req.body;

  await MyViewedServiceProvider.find({ user: userID })

    .populate({
      path: "provider",
      populate: { path: "service", select: "serviceName" },
    })
    .populate({ path: "provider", populate: { path: "provider" } })

    .limit(4)
    .then((response) => {
      res.send(response);
    })

    .catch((err) => {
      console.log(err);
      res.json({
        status: "Failed",
        message: "Error occured while getting service provider data",
      });
    });
});

//get saved
router.get("/saved", async (req, res) => {
  const { userID } = req.body;

  await MySavedServiceProvider.find({ user: userID })

    .populate({
      path: "provider",
      populate: { path: "service", select: "serviceName" },
    })
    .populate({ path: "provider", populate: { path: "provider" } })

    .limit(4)
    .then((response) => {
      res.send(response);
    })

    .catch((err) => {
      console.log(err);
      res.json({
        status: "Failed",
        message: "Error occured while getting service provider data",
      });
    });
});

module.exports = router;
