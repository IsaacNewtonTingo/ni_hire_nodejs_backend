const express = require("express");
const router = express.Router();

const User = require("../models/user");
const { MySavedServiceProvider } = require("../models/my-saved-provider");
const { MyViewedServiceProvider } = require("../models/my-viewed-providers");
const { Service } = require("../models/service");
const { ServiceProvider } = require("../models/service-provider");
const { Review } = require("../models/review");
const { PromotedService } = require("../models/promoted-services");
const { Category } = require("../models/category");

var nodemailer = require("nodemailer");
const request = require("request");

let transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASS,
  },
});

//post service
router.post("/add-service", async (req, res) => {
  let {
    service,
    category,
    description,
    image1,
    image2,
    image3,
    rate,
    provider,
  } = req.body;

  service = service.trim();
  category = category.trim();
  description = description.trim();
  image1 = image1.trim();
  image2 = image2.trim();
  image3 = image3.trim();
  rate = rate.toString().trim();
  provider = provider.trim();

  if (!service) {
    res.json({
      status: "Failed",
      message: "Service is missing",
    });
  } else if (!category) {
    res.json({
      status: "Failed",
      message: "Category is missing",
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
    await User.findOne({ _id: provider })
      .then(async (userResponse) => {
        if (userResponse) {
          const isUserPremium = userResponse.isFeatured;

          //check if category is valid
          await Category.findOne({ _id: category })
            .then(async (response) => {
              if (response) {
                //valid category
                //check if service is already in db
                await Service.findOne({
                  serviceName: service,
                })
                  .then(async (response) => {
                    if (response) {
                      //service exists
                      //don't add to db

                      const newServiceProvider = ServiceProvider({
                        service: response._id,
                        description,
                        image1,
                        image2,
                        image3,
                        rate: parseInt(rate),
                        rating: 0,
                        isPromoted: isUserPremium,
                        datePromoted: "",
                        dateExpiring: "",
                        dateCreated: Date.now(),
                        provider,
                      });

                      //check if they already have the service
                      const serviceID = response._id;

                      await ServiceProvider.findOneAndDelete({
                        $and: [{ service: serviceID }, { provider }],
                      })
                        .then((response) => {
                          if (response) {
                            //service was there and is deleted
                            newServiceProvider
                              .save()
                              .then(() => {
                                res.json({
                                  status: "Success",
                                  message: "Replaced successfully",
                                });
                              })
                              .catch((err) => {
                                console.log(err);
                                res.json({
                                  status: "Failed",
                                  message:
                                    "Error occured while replacing service",
                                });
                              });
                          } else {
                            //service wasnt there
                            newServiceProvider
                              .save()
                              .then(() => {
                                res.json({
                                  status: "Success",
                                  message: "Posted successfully",
                                });
                              })
                              .catch((err) => {
                                console.log(err);
                                res.json({
                                  status: "Failed",
                                  message:
                                    "Error occured while posting service",
                                });
                              });
                          }
                        })
                        .catch((err) => {
                          console.log(err);
                          res.json({
                            status: "Failed",
                            message: "Error occured while posting service",
                          });
                        });
                    } else {
                      //service doesnt exists
                      //add service to db
                      const newService = new Service({
                        serviceName: service,
                        category: category,
                      });

                      await newService
                        .save()
                        .then(async (response) => {
                          const newServiceProvider = ServiceProvider({
                            service: response._id,
                            description,
                            image1,
                            image2,
                            image3,
                            rate,
                            // rate: parseInt(rate.replace(/,/g, "")),
                            rating: 0,
                            isPromoted: false,
                            datePromoted: "",
                            dateCreated: Date.now(),
                            provider,
                          });
                          //add service provider
                          newServiceProvider
                            .save()
                            .then(() => {
                              res.json({
                                status: "Success",
                                message: "Posted successfully",
                              });
                            })
                            .catch((err) => {
                              console.log(err);
                              res.json({
                                status: "Failed",
                                message: "Error occured while posting service",
                              });
                            });
                        })
                        .catch((err) => {
                          console.log(err);
                          res.json({
                            status: "Failed",
                            message: "Error occured while saving service",
                          });
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
                  message: "Invalid category",
                });
              }
            })
            .catch((err) => {
              console.log(err);
              res.json({
                status: "Failed",
                message: "Error occured while finding user data",
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
          message: "Error occured while finding user data",
        });
      });
  }
});

//Get all service providers
router.get("/get-all-service-providers", async (req, res) => {
  const {
    pageNumber = 0,
    limit = 20,

    isPromoted,
    rate,
    rating,
  } = req.query;

  const serviceProviders = await ServiceProvider.find({})
    .populate({ path: "service", populate: { path: "category" } })
    .populate("provider")
    .sort({ isPromoted: isPromoted, rate, rating })
    .skip(parseInt(pageNumber) * parseInt(limit))
    .limit(parseInt(limit));

  const serviceProviderCount = await ServiceProvider.countDocuments();

  res.json({
    serviceProviders: serviceProviders,
    serviceProviderCount,
  });
});

//Get a specific service provider
router.get("/get-one-service-provider/:id", async (req, res) => {
  const serviceProviderID = req.params.id;
  if (serviceProviderID.match(/^[0-9a-fA-F]{24}$/)) {
    //valid ID
    const serviceProvider = await ServiceProvider.findById(
      {
        _id: serviceProviderID,
      },
      "-datePromoted -dateCreated -dateExpiring"
    )
      // .populate({ path: "service", populate: { path: "category" } })
      .populate({ path: "service", select: "serviceName" })
      .populate({
        path: "provider",
        select:
          "-password -bio -verified -generalPromotedTitle -dateFeatured -dateCreated -dateExpiring",
      })
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
    const serviceProviders = await ServiceProvider.find(
      {
        category: categoryID,
      },
      "-datePromoted -dateCreated -dateExpiring"
    )
      .populate({ path: "service", select: "serviceName" })
      .populate({
        path: "provider",
        select:
          "-password -bio -verified -generalPromotedTitle -datePromoted -dateCreated -dateExpiring -dateFeatured",
      })

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

//Get service providers in a given job
router.get(
  "/service/get-all-service-providers/:serviceName",
  async (req, res) => {
    const serviceName = req.params.serviceName.trim();
    const {
      limit = 20,
      pageNumber = 0,
      isPromoted,
      rate,
      rating,
      location,
    } = req.query;

    //check if service exists
    await Service.findOne({ serviceName })
      .then(async (response) => {
        if (response) {
          const serviceID = response._id;

          if (!location) {
            if (!isPromoted) {
              const serviceProviders = await ServiceProvider.find(
                {
                  service: serviceID,
                },
                "-datePromoted -dateCreated -dateExpiring"
              )
                .populate({ path: "service", select: "serviceName" })
                .populate({
                  path: "provider",
                  select:
                    "-password -bio -verified -generalPromotedTitle -dateFeatured -dateCreated -dateExpiring",
                })

                .sort({ isPromoted: -1 })
                .skip(parseInt(pageNumber) * parseInt(limit))
                .limit(parseInt(limit))

                .catch((err) => {
                  console.log(err);
                  res.json({
                    status: "Failed",
                    message: "Error getting service providers",
                  });
                });

              const serviceProviderCount = serviceProviders.length;

              res.json({
                serviceProviders: serviceProviders,
                serviceProviderCount,
              });
            } else {
              const serviceProviders = await ServiceProvider.find(
                {
                  service: serviceID,
                },
                "-datePromoted -dateCreated -dateExpiring"
              )
                .populate({ path: "service", select: "serviceName" })
                .populate({
                  path: "provider",
                  select:
                    "-password -bio -verified -generalPromotedTitle -dateFeatured -dateCreated -dateExpiring",
                })

                .sort({ rate: parseInt(rate), rating: parseInt(rating) })
                .skip(parseInt(pageNumber) * parseInt(limit))
                .limit(parseInt(limit))

                .catch((err) => {
                  console.log(err);
                  res.json({
                    status: "Failed",
                    message: "Error getting service providers",
                  });
                });

              const serviceProviderCount = serviceProviders.length;

              res.json({
                serviceProviders,
                serviceProviderCount,
              });
            }
          } else {
            if (!isPromoted) {
              const serviceProviders = await ServiceProvider.find(
                {
                  service: serviceID,
                },
                "-datePromoted -dateCreated -dateExpiring"
              )
                .populate({ path: "service", select: "serviceName" })
                .populate({
                  path: "provider",
                  select:
                    "-password -bio -verified -generalPromotedTitle -dateFeatured -dateCreated -dateExpiring",
                })

                .sort({ isPromoted: -1 })
                .skip(parseInt(pageNumber) * parseInt(limit))
                .limit(parseInt(limit))

                .catch((err) => {
                  console.log(err);
                  res.json({
                    status: "Failed",
                    message: "Error getting service providers",
                  });
                });

              let filteredUsers = serviceProviders.filter(function (
                serviceProviders
              ) {
                if (serviceProviders.provider.location == location) {
                  return true;
                }
              });

              const serviceProviderCount = filteredUsers.length;

              res.json({
                serviceProviders: filteredUsers,
                serviceProviderCount,
              });
            } else {
              const serviceProviders = await ServiceProvider.find(
                {
                  service: serviceID,
                },
                "-datePromoted -dateCreated -dateExpiring"
              )
                .populate({ path: "service", select: "serviceName" })
                .populate({
                  path: "provider",
                  select:
                    "-password -bio -verified -generalPromotedTitle -dateFeatured -dateCreated -dateExpiring",
                })

                .sort({ rate: parseInt(rate), rating: parseInt(rating) })
                .skip(parseInt(pageNumber) * parseInt(limit))
                .limit(parseInt(limit))

                .catch((err) => {
                  console.log(err);
                  res.json({
                    status: "Failed",
                    message: "Error getting service providers",
                  });
                });

              let filteredUsers = serviceProviders.filter(function (
                serviceProviders
              ) {
                if (serviceProviders.provider.location == location) {
                  return true;
                }
              });

              const serviceProviderCount = filteredUsers.length;

              res.json({
                serviceProviders: filteredUsers,
                serviceProviderCount,
              });
            }
          }
        } else {
          res.json({
            status: "Failed",
            message: "Service not found",
          });
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }
);

//Get featured service providers
router.get("/get-featured", async (req, res) => {
  const {
    limit = 20,
    pageNumber = 0,
    serviceName,
    location,
    rate,
    rating,
  } = req.query;

  await ServiceProvider.find(
    { isPromoted: true },
    "-datePromoted -dateCreated -dateExpiring"
  )
    .populate({ path: "service", select: "serviceName" })
    .populate({
      path: "provider",
      select:
        "-password -bio -verified -generalPromotedTitle -datePromoted -dateCreated -dateExpiring -dateFeatured",
    })

    .skip(parseInt(pageNumber) * parseInt(limit))
    .limit(parseInt(limit))

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
  let { serviceProviderID, userID } = req.body;

  serviceProviderID = serviceProviderID.trim();
  userID = userID.trim();

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
                        dateViewed: Date.now(),
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
router.post("/save-service", async (req, res) => {
  let { serviceProviderID, userID } = req.body;

  serviceProviderID = serviceProviderID.trim();
  userID = userID.trim();

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
                        dateSaved: Date.now(),
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

//get saved
router.get("/get-saved-services/:id", async (req, res) => {
  const userID = req.params.id;

  await MySavedServiceProvider.find({ user: userID })

    .populate({
      path: "provider",
      populate: { path: "service", select: "serviceName" },
    })
    .populate({
      path: "provider",
      select: "-image2 -image3 -datePromoted -dateCreated -dateExpiring",
      populate: {
        path: "provider",
        select:
          "-password -generalPromotedTitle -dateFeatured -bio -profilePicture -verified -email -phoneNumber",
      },
    })
    .sort({ dateSaved: -1 })

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

//Check if service is saved by a user
router.get("/check-if-saved/:id", async (req, res) => {
  const serviceProviderID = req.params.id;
  const { currentUserID } = req.query;
  //Check if service is available
  await ServiceProvider.findOne({ _id: serviceProviderID })
    .then(async (response) => {
      if (response) {
        //service is available
        //check if it has been saved
        await MySavedServiceProvider.findOne({
          $and: [{ user: currentUserID }, { provider: serviceProviderID }],
        })
          .then((response) => {
            if (response) {
              //It is saved
              res.json({
                status: "Success",
                message: "You had saved the service",
              });
            } else {
              //Not saved

              res.json({
                status: "Failed",
                message: "You have not saved the service",
              });
            }
          })
          .catch((err) => {
            console.log(err);
            res.json({
              status: "Failed",
              message: "Error occured while checking saved data",
            });
          });
      } else {
        //Service not found
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
        message: "Error occured while checking service data",
      });
    });
});

//Remove from saves
router.delete("/unsave-service/:id", async (req, res) => {
  const serviceProviderID = req.params.id;
  const { currentUserID } = req.query;

  await ServiceProvider.findOne({ _id: serviceProviderID })
    .then(async (response) => {
      if (response) {
        //Service available
        //Check if user is still available
        await User.findOne({ _id: currentUserID })
          .then(async (response) => {
            if (response) {
              //User is available
              //Find the saved service and delete
              await MySavedServiceProvider.findOneAndDelete({
                $and: [
                  { user: currentUserID },
                  { provider: serviceProviderID },
                ],
              })
                .then((response) => {
                  if (response) {
                    res.json({
                      status: "Success",
                      message: "Item deleted from saved items",
                    });
                  } else {
                    res.json({
                      status: "Failed",
                      message: "Item not found to be deleted",
                    });
                  }
                })
                .catch((err) => {
                  console.log(err);
                  res.json({
                    status: "Failed",
                    message: "Error occured while deleting saved item",
                  });
                });
            } else {
              //User not available
              res.json({
                status: "Failed",
                message: "User not found. Might have been deleted",
              });
            }
          })
          .catch((err) => {
            console.log(err);
            res.json({
              status: "Failed",
              message: "Error occured while getting user data",
            });
          });
      } else {
        //Service not available
        res.json({
          status: "Failed",
          message: "Service not availble. Might have been deleted",
        });
      }
    })
    .catch((err) => {
      console.log(err);
      res.json({
        status: "Failed",
        message: "Error occured while checking service details",
      });
    });
});

//Get recently viewed
router.get("/recently-viewed/:id", async (req, res) => {
  const userID = req.params.id;

  await MyViewedServiceProvider.find({ user: userID })
    .populate({ path: "provider", select: "-image2 -image3" })
    .populate({
      path: "provider",
      populate: { path: "service", select: "serviceName" },
    })
    .populate({
      path: "provider",
      select: "-image2 -image3 -datePromoted -dateCreated -dateExpiring",
      populate: {
        path: "provider",
        select:
          "-password -generalPromotedTitle -dateFeatured -bio -profilePicture -verified -email -phoneNumber",
      },
    })
    .sort({ dateViewed: -1 })

    .limit(10)
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

//Get service viewers
router.get("/get-service-viewers/:id", async (req, res) => {
  const serviceProviderID = req.params.id;
  const { providerID } = req.query;

  //Check provider details
  await User.findOne({ _id: providerID }).then(async (response) => {
    if (response) {
      //Provider is present
      const isPremium = response.isFeatured;

      if (isPremium == true) {
        //send data with user details
        await MyViewedServiceProvider.find({
          provider: serviceProviderID,
        })
          .populate("user")
          .populate({ path: "provider", populate: { path: "provider" } })

          .then((response) => {
            res.json({
              message: "Feat",
              data: response.map((response) => ({
                _id: response.user._id,
                firstName: response.user.firstName,
                lastName: response.user.lastName,
                email: response.user.email,
                phoneNumber: response.user.phoneNumber,
                bio: response.user.bio,
                location: response.user.location,
                profilePicture: response.user.profilePicture,
              })),
            });
          })
          .catch((err) => {
            console.log(err);
            res.json({
              status: "Failed",
              message: "Error occured while getting service views",
            });
          });
      } else {
        await MyViewedServiceProvider.find({
          provider: serviceProviderID,
        })
          .populate("user")
          .populate({ path: "provider", populate: { path: "provider" } })

          .then((response) => {
            res.json({
              data: response.map((response) => ({
                firstName: response.user.firstName,
              })),
            });
          })
          .catch((err) => {
            console.log(err);
            res.json({
              status: "Failed",
              message: "Error occured while getting service views",
            });
          });
      }
    } else {
      //Provider not found
      res.json({
        status: "Failed",
        message: "Service provider not found",
      });
    }
  });
});

//get service rating
router.get("/get-service-rating/:id", async (req, res) => {
  const serviceProviderID = req.params.id;
  //check if the service is still available
  await ServiceProvider.findOne({ _id: serviceProviderID }, "_id")
    .then(async (response) => {
      if (response) {
        //is available
        //get all reviews
        await Review.find({ serviceReviewed: serviceProviderID }, "rating")
          .then((response) => {
            if (response.length > 0) {
              //reviews found
              const numReviews = response.length;

              var totalRating = response
                .map((reviews) => reviews.rating)
                .reduce((acc, rating) => acc + rating);

              var finalRating = totalRating / numReviews;

              res.json({
                status: "Success",
                message: "Successfully compiled rating",
                rating: finalRating.toFixed(1),
              });
            } else {
              //no reviews
              res.json({
                status: "Success",
                message: "No reviews found",
                rating: 0,
              });
            }
          })
          .catch((err) => {
            console.log(err);
            res.json({
              status: "Failed",
              message: "Error occured while checking review records",
            });
          });
      } else {
        //not available
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
        message: "Error occured while checking service records",
      });
    });
});

//search service providers
router.get("/filter-service-provider", async (req, res) => {
  const {
    serviceName,
    location,

    limit = 20,
    pageNumber = 0,

    rate,
    rating,
    isPromoted,
  } = req.query;
  const newLocation = "Kenya";

  if (serviceName && !location) {
    const servers = await ServiceProvider.find(
      {},
      "-image2 -image3 -datePromoted -dateCreated"
    )
      .sort({
        rate: parseInt(rate),
        rating: parseInt(rating),
        isPromoted: parseInt(isPromoted),
      })
      .populate({ path: "service", select: "serviceName" })

      .populate({
        path: "provider",
        select:
          "-password -generalPromotedTitle -dateFeatured -bio -profilePicture -verified -email -phoneNumber",
      })

      .skip(parseInt(pageNumber) * parseInt(limit))
      .limit(parseInt(limit))

      .catch((err) => {
        console.log(err);
        res.json({
          status: "Failed",
          message: "Error occured while searching service",
        });
      });

    let filteredServiceProviders = servers.filter(function (servers) {
      if (servers.service.serviceName == serviceName) {
        return true;
      }
    });

    const serviceProviderCount = filteredServiceProviders.length;

    res.json({
      serviceProviders: filteredServiceProviders,
      serviceProviderCount,
    });
  } else if (serviceName && location) {
    const servers = await ServiceProvider.find(
      {},
      "-image2 -image3 -datePromoted -dateCreated"
    )
      .sort({
        rate: parseInt(rate),
        rating: parseInt(rating),
        isPromoted: parseInt(isPromoted),
      })
      .populate({ path: "service", select: "serviceName" })

      .populate({
        path: "provider",
        select:
          "-password -generalPromotedTitle -dateFeatured -bio -profilePicture -verified -email -phoneNumber",
      })

      .skip(parseInt(pageNumber) * parseInt(limit))
      .limit(parseInt(limit))

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
        servers.provider.location.trim() == location.trim()
      ) {
        return true;
      }
    });
    const serviceProviderCount = filteredServiceProviders.length;

    res.json({
      serviceProviders: filteredServiceProviders,
      serviceProviderCount,
    });
  } else if (!serviceName && location) {
    const servers = await ServiceProvider.find(
      {},
      "-image2 -image3 -datePromoted -dateCreated"
    )
      .sort({
        rate: parseInt(rate),
        rating: parseInt(rating),
        isPromoted: parseInt(isPromoted),
      })
      .populate({ path: "service", select: "serviceName" })

      .populate({
        path: "provider",
        select:
          "-password -generalPromotedTitle -dateFeatured -bio -profilePicture -verified -email -phoneNumber",
      })

      .skip(parseInt(pageNumber) * parseInt(limit))
      .limit(parseInt(limit))

      .catch((err) => {
        console.log(err);
        res.json({
          status: "Failed",
          message: "Error occured while searching service",
        });
      });

    let filteredServiceProviders = servers.filter(function (servers) {
      if (servers.provider.location.trim() == location.trim()) {
        return true;
      }
    });

    const serviceProviderCount = filteredServiceProviders.length;

    res.json({
      serviceProviders: filteredServiceProviders,
      serviceProviderCount,
    });
  } else {
    const servers = await ServiceProvider.find(
      {},
      "-image2 -image3 -datePromoted -dateCreated"
    )
      .sort({
        isPromoted: parseInt(isPromoted),
        rate: parseInt(rate),
      })
      .populate({ path: "service", select: "serviceName" })

      .populate({
        path: "provider",
        select:
          "-password -generalPromotedTitle -dateFeatured -bio -profilePicture -verified -email -phoneNumber",
      })

      .skip(parseInt(pageNumber) * parseInt(limit))
      .limit(parseInt(limit))

      .catch((err) => {
        console.log(err);
        res.json({
          status: "Failed",
          message: "Error occured while searching service",
        });
      });

    const serviceProviderCount = await ServiceProvider.countDocuments();

    res.json({
      serviceProviders: servers,
      serviceProviderCount,
    });
  }
});

//get user services
router.get("/get-my-services/:id", async (req, res) => {
  const userID = req.params.id;
  await ServiceProvider.find(
    { provider: userID },
    "-datePromoted -image2 -image3"
  )
    .sort({ dateCreated: -1 })
    .populate({ path: "service", select: "serviceName" })
    .populate({
      path: "provider",
      select:
        "-password -generalPromotedTitle -dateFeatured -bio -profilePicture -verified -email -phoneNumber -dateExpiring",
    })
    .then((response) => {
      if (response.length > 0) {
        res.json(response);
      } else {
        res.json({
          status: "Failed",
          message: "User has no services",
        });
      }
    })
    .catch((err) => {
      console.log(err);
      res.json({
        status: "Failed",
        message: "Error occured while getting user services",
      });
    });
});

//add review
router.post("/add-review/:id", async (req, res) => {
  let { userID, reviewMessage, rating } = req.body;
  const serviceProviderID = req.params.id;

  userID = userID.trim();
  reviewMessage = reviewMessage.trim();

  //check if user exists
  await User.findOne({ _id: userID })
    .then(async (response) => {
      if (response) {
        //get the job first using jobID
        await ServiceProvider.findOne({ _id: serviceProviderID })
          .then(async (response) => {
            if (response) {
              //check if user wants to rate themselves
              if (response.provider != userID) {
                //you can add review
                const newReview = new Review({
                  whoReviewed: userID,
                  serviceReviewed: serviceProviderID,
                  createdAt: Date.now(),
                  reviewMessage,
                  rating,
                });

                await newReview
                  .save()
                  .then(async () => {
                    //get initial data

                    await ServiceProvider.findOne({ _id: serviceProviderID })
                      .then(async (response) => {
                        if (response) {
                          //find average
                          const oldRating = response.rating;
                          const newRating = (oldRating + rating) / 2;

                          //update
                          await ServiceProvider.updateOne(
                            { _id: serviceProviderID },
                            { rating: newRating.toFixed(1) }
                          )
                            .then(() => {
                              res.json({
                                status: "Success",
                                message: "Review added successfully",
                              });
                            })
                            .catch((err) => {
                              console.log(err);
                              res.json({
                                status: "Failed",
                                message: "Error occured while updating rating",
                              });
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
                          message: "Error occured while getting service",
                        });
                      });
                  })
                  .catch((err) => {
                    res.json({
                      status: "Failed",
                      message: "Error occured while saving review",
                    });
                  });
              } else {
                res.json({
                  status: "Failed",
                  message: "You cannot review yourself",
                });
              }
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
              message: "Error occured while getting job details",
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
        message: "Error occured while getting user details",
      });
    });
});

//get reviews for a service
router.get("/get-reviews-for-a-service/:id", async (req, res) => {
  const serviceProviderID = req.params.id;

  //check if service is available
  await ServiceProvider.findOne({ _id: serviceProviderID })
    .then(async (response) => {
      if (response) {
        await Review.find({ serviceReviewed: serviceProviderID })
          .populate({ path: "serviceReviewed", select: "_id" })
          .populate({ path: "whoReviewed", select: "_id firstName lastName" })

          .sort({ createdAt: -1 })
          .then((response) => {
            if (response.length > 0) {
              res.json(response);
            } else {
              res.json({
                status: "Failed",
                message: "No reviews available",
              });
            }
          })
          .catch((err) => {
            console.log(err);
            res.json({
              status: "Failed",
              message: "Error occured while getting reviews",
            });
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
        message: "Error occured while getting service details",
      });
    });
});

//get all reviews
router.get("/get-all-reviews/:id", async (req, res) => {
  const userID = req.params.id;

  //check if user is available
  await User.findOne({ _id: userID })
    .then(async (response) => {
      if (response) {
        const reviews = await Review.find({})
          .populate({
            path: "serviceReviewed",
            select: "_id",
            populate: { path: "provider", select: "_id" },
          })
          .populate({ path: "whoReviewed", select: "_id firstName lastName" })
          .catch((err) => {
            console.log(err);
            res.json({
              status: "Failed",
              message: "Error occured while getting reviews",
            });
          });

        let filteredReviews = reviews.filter(function (reviews) {
          if (
            reviews.serviceReviewed != null &&
            reviews.serviceReviewed.provider._id == userID
          ) {
            return true;
          }
        });
        res.send(filteredReviews);
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
        message: "Error occured while getting user data",
      });
    });
});

//delete review
router.delete("/delete-review/:id", async (req, res) => {
  const reviewID = req.params.id;
  const { userID } = req.query;

  //Check if user exists
  await User.findOne({ _id: userID })
    .then(async (response) => {
      if (response) {
        //check if review exists
        await Review.findOneAndDelete({
          $and: [{ _id: reviewID }, { whoReviewed: userID }],
        })
          .then((response) => {
            if (response != null) {
              res.json({
                status: "Success",
                message: "Review deleted sucessfully",
              });
            } else {
              res.json({
                status: "Failed",
                message: "Review not found. Might have been deleted",
              });
            }
          })
          .catch((err) => {
            console.log(err);
            res.json({
              status: "Failed",
              message: "Error occured while deleting review",
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
        message: "Error occured while finding user",
      });
    });
});

//edit service
router.put("/edit-service-provider/:id", async (req, res) => {
  const serviceProviderID = req.params.id;
  let { userID, providerID } = req.body;

  userID = userID.trim();
  providerID = providerID.trim();

  const filter = {
    _id: serviceProviderID,
  };

  if (userID != providerID) {
    res.json({
      status: "Failed",
      message: "Action not authorized",
    });
  } else {
    //check if service provider id exists(_id)
    await ServiceProvider.findOneAndUpdate(
      filter,
      {
        description: req.body.description,
        image1: req.body.image1,
        image2: req.body.image2,
        image3: req.body.image3,
        rate: req.body.rate,
      },
      {
        new: true,
      }
    )
      .then((response) => {
        res.json({
          status: "Success",
          message: "Service updated successfully",
        });
      })
      .catch((err) => {
        console.log(err);
        res.json({
          status: "Failed",
          message: "Error occured while updating service",
        });
      });
  }
});

//delete service
router.delete("/delete-service-provider/:id", async (req, res) => {
  const serviceProviderID = req.params.id;
  const { userID } = req.query;

  await ServiceProvider.findOne({ _id: serviceProviderID })
    .then(async (response) => {
      if (response) {
        if (response.provider != userID) {
          res.json({
            status: "Failed",
            message: "Action not authorized",
          });
        } else {
          await ServiceProvider.deleteOne({ _id: serviceProviderID })
            .then(async () => {
              await Review.find({ serviceReviewed: serviceProviderID })
                .then(async (response) => {
                  if (response.length > 0) {
                    //reviews found
                    await Review.deleteMany({
                      serviceReviewed: serviceProviderID,
                    })
                      .then(async () => {
                        //find all recent views and delete
                        await MyViewedServiceProvider.find({
                          provider: serviceProviderID,
                        })
                          .then(async (response) => {
                            if (response.length > 0) {
                              //Recent views found
                              //delete recent views
                              await MyViewedServiceProvider.deleteMany({
                                provider: serviceProviderID,
                              })
                                .then(async () => {
                                  //check if saved by a user and delete
                                  await MySavedServiceProvider.find({
                                    provider: serviceProviderID,
                                  })
                                    .then(async (response) => {
                                      if (response.length > 0) {
                                        //has been saved
                                        await MySavedServiceProvider.deleteMany(
                                          { provider: serviceProviderID }
                                        )
                                          .then(() => {
                                            res.json({
                                              status: "Success",
                                              message:
                                                "Service deleted successfully",
                                            });
                                          })
                                          .catch((err) => {
                                            console.log(err);
                                            res.json({
                                              status: "Failed",
                                              message:
                                                "Error occured while deleting saved",
                                            });
                                          });
                                      } else {
                                        //not saved
                                        res.json({
                                          status: "Success",
                                          message:
                                            "Service deleted successfully",
                                        });
                                      }
                                    })
                                    .catch((err) => {
                                      console.log(err);
                                      res.json({
                                        status: "Failed",
                                        message:
                                          "Error occured while getting saved data",
                                      });
                                    });
                                })
                                .catch((err) => {
                                  res.json({
                                    status: "Failed",
                                    message:
                                      "Error occured while deleting reviews and recent views",
                                  });
                                });
                            } else {
                              //no recent views
                              //check if saved and delete

                              await MySavedServiceProvider.find({
                                provider: serviceProviderID,
                              })
                                .then(async (response) => {
                                  if (response.length > 0) {
                                    //has been saved
                                    await MySavedServiceProvider.deleteMany({
                                      provider: serviceProviderID,
                                    })
                                      .then(() => {
                                        res.json({
                                          status: "Success",
                                          message:
                                            "Service deleted successfully",
                                        });
                                      })
                                      .catch((err) => {
                                        console.log(err);
                                        res.json({
                                          status: "Failed",
                                          message:
                                            "Error occured while deleting saved",
                                        });
                                      });
                                  } else {
                                    //not saved
                                    res.json({
                                      status: "Success",
                                      message: "Service deleted successfully",
                                    });
                                  }
                                })
                                .catch((err) => {
                                  console.log(err);
                                  res.json({
                                    status: "Failed",
                                    message:
                                      "Error occured while getting saved data",
                                  });
                                });
                            }
                          })
                          .catch((err) => {
                            console.log(err);
                            res.json({
                              status: "Failed",
                              message:
                                "Error occured while getting recent views",
                            });
                          });
                      })
                      .catch((err) => {
                        console.log(err);
                        res.json({
                          status: "Failed",
                          message: "Error occured while deleting reviews",
                        });
                      });
                  } else {
                    //reviews not found
                    await MyViewedServiceProvider.find({
                      provider: serviceProviderID,
                    })
                      .then(async (response) => {
                        if (response.length > 0) {
                          //Recent views found
                          //delete recent views
                          await MyViewedServiceProvider.deleteMany({
                            provider: serviceProviderID,
                          })
                            .then(async () => {
                              //check if saved and delete
                              await MySavedServiceProvider.find({
                                provider: serviceProviderID,
                              })
                                .then(async (response) => {
                                  if (response.length > 0) {
                                    //has been saved
                                    await MySavedServiceProvider.deleteMany({
                                      provider: serviceProviderID,
                                    })
                                      .then(() => {
                                        res.json({
                                          status: "Success",
                                          message:
                                            "Service deleted successfully",
                                        });
                                      })
                                      .catch((err) => {
                                        console.log(err);
                                        res.json({
                                          status: "Failed",
                                          message:
                                            "Error occured while deleting saved",
                                        });
                                      });
                                  } else {
                                    //not saved
                                    res.json({
                                      status: "Success",
                                      message: "Service deleted successfully",
                                    });
                                  }
                                })
                                .catch((err) => {
                                  console.log(err);
                                  res.json({
                                    status: "Failed",
                                    message:
                                      "Error occured while getting saved data",
                                  });
                                });
                            })
                            .catch((err) => {
                              res.json({
                                status: "Failed",
                                message:
                                  "Error occured while deleting recent views",
                              });
                            });
                        } else {
                          //no recent views
                          await MySavedServiceProvider.find({
                            provider: serviceProviderID,
                          })
                            .then(async (response) => {
                              if (response.length > 0) {
                                //has been saved
                                await MySavedServiceProvider.deleteMany({
                                  provider: serviceProviderID,
                                })
                                  .then(() => {
                                    res.json({
                                      status: "Success",
                                      message: "Service deleted successfully",
                                    });
                                  })
                                  .catch((err) => {
                                    console.log(err);
                                    res.json({
                                      status: "Failed",
                                      message:
                                        "Error occured while deleting saved",
                                    });
                                  });
                              } else {
                                //not saved
                                res.json({
                                  status: "Success",
                                  message: "Service deleted successfully",
                                });
                              }
                            })
                            .catch((err) => {
                              console.log(err);
                              res.json({
                                status: "Failed",
                                message:
                                  "Error occured while getting saved data",
                              });
                            });
                        }
                      })
                      .catch((err) => {
                        console.log(err);
                        res.json({
                          status: "Failed",
                          message: "Error occured while getting recent views",
                        });
                      });
                  }
                })
                .catch((err) => {
                  console.log(err);
                  res.json({
                    status: "Failed",
                    message: "Error occured while getting review data",
                  });
                });
            })

            .catch((err) => {
              console.log(err);
              res.json({
                status: "Failed",
                message: "Error occured while getting service data",
              });
            });
        }
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
        message: "Error occured while getting service data",
      });
    });
});

//promote servie
router.post("/promote-service/:id", async (req, res) => {
  let { phoneNumber, userID } = req.body;
  const serviceProviderID = req.params.id;
  const amount = 1;

  phoneNumber = phoneNumber.toString().trim();
  userID = userID.trim();

  //check if service exists
  await ServiceProvider.findOne({ _id: serviceProviderID })
    .then((response) => {
      if (response) {
        //check if user id == provider id
        if (response.provider != userID) {
          res.json({
            status: "Failed",
            message: "Action not authorized",
          });
        } else {
          //perform stk push
          const url =
            "https://tinypesa.com/api/v1/express/initialize?https://ni-hire-backend.herokuapp.com/app/service-provider/promote-service";
          request(
            {
              url: url,
              method: "POST",
              headers: {
                Apikey: process.env.TINY_PESA_API_KEY_REGISTRATION,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body:
                "amount=" +
                amount +
                "&msisdn=" +
                parseInt(phoneNumber) +
                "&account_no=200",
            },
            function (error, response, body) {
              if (error) {
                console.log(error);
              } else {
                res.json({
                  status: "Success",
                  message:
                    "Your request is being processed.Wait for M-Pesa prompt on your phone.",
                });
              }
            }
          );
        }
      } else {
        res.json({
          status: "Failed",
          message: "Servie not found",
        });
      }
    })
    .catch((err) => {
      console.log(err);
      res.json({
        status: "Failed",
        message: "Error occured while getting service data",
      });
    });
});

router.post("/service-promotion-callback", (req, res) => {
  //Payment is successful
  if (req.body.Body.stkCallback.ResultCode == 0) {
    //pass amount,phoneNumber to this function
    const phoneNumber = req.body.Body.stkCallback.Msisdn;
    const amount = req.body.Body.stkCallback.Amount;

    savePaymentToDB({ phoneNumber, amount });
  } else {
    //Payment unsuccessfull
    console.log("Request not completed/Cancelled");
  }
});

//save service promotion data
const savePaymentToDB = async ({ amount, phoneNumber }) => {
  const newPromotedService = new PromotedService({
    datePromoted: Date.now(),
    expiryDate: Date.now() + 604800000,
    amountPaid: amount,
    phoneNumber: phoneNumber,
  });

  await newPromotedService
    .save()
    .then(() => {})
    .catch((err) => {
      console.log(err);
    });

  const mailOptions = {
    from: process.env.AUTH_EMAIL,
    to: "newtontingo@gmail.com",
    subject: "Service promotion payment alert",
    html: `<p><strong>${phoneNumber}</strong> has paid <strong>KSH. ${amount}</strong> as registration fee in your investment mobile application</p>`,
  };

  await transporter.sendMail(mailOptions).catch((err) => {
    console.log(err);
  });
};

module.exports = router;
