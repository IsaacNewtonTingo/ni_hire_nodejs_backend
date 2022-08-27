const express = require("express");
const router = express.Router();

const User = require("../models/user");
const { MySavedServiceProvider } = require("../models/my-saved-provider");
const { MyViewedServiceProvider } = require("../models/my-viewed-providers");
const { Service } = require("../models/service");
const { ServiceProvider } = require("../models/service-provider");
const { Review } = require("../models/review");
const { PromotedService } = require("../models/promoted-services");

var nodemailer = require("nodemailer");
const request = require("request");

let transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASS,
  },
});

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
    .populate({ path: "service", populate: { path: "category" } })
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
      .populate({ path: "service", populate: { path: "category" } })
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
      .populate({ path: "service", populate: { path: "category" } })
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
    .populate({ path: "service", populate: { path: "category" } })
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

//search service providers
router.get("/search-service-provider", async (req, res) => {
  const { serviceName, location, sort } = req.query;
  const newLocation = "Kenya";

  if (serviceName && !location) {
    const servers = await ServiceProvider.find({})
      .sort(sort)
      .populate({ path: "service", populate: { path: "category" } })
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
        servers.provider.location.includes(newLocation)
      ) {
        return true;
      }
    });

    res.send(filteredServiceProviders);
  } else if (serviceName && location) {
    const servers = await ServiceProvider.find({})
      .sort(sort)
      .populate({ path: "service", populate: { path: "category" } })
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
        servers.provider.location.trim() == location.trim()
      ) {
        return true;
      }
    });

    res.send(filteredServiceProviders);
  } else if (!serviceName && location) {
    const servers = await ServiceProvider.find({})
      .sort(sort)
      .populate({ path: "service", populate: { path: "category" } })
      .populate("provider")
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

    res.send(filteredServiceProviders);
  } else {
    const servers = await ServiceProvider.find({})
      .sort(sort)
      .populate({ path: "service", populate: { path: "category" } })
      .populate("provider")
      .catch((err) => {
        console.log(err);
        res.json({
          status: "Failed",
          message: "Error occured while searching service",
        });
      });
    res.send(servers);
  }
});

//get user services
router.get("/get-my-services/:id", async (req, res) => {
  const userID = req.params.id;
  await ServiceProvider.find({ provider: userID })
    .populate({ path: "service", populate: { path: "category" } })
    .populate("provider")
    .then((response) => {
      if (response.length > 0) {
        res.json({
          status: "Success",
          data: response,
        });
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
  const { userID, serviceProviderID, reviewMessage, rating } = req.body;
  const serviceID = req.params.id;

  //check if user wants to rate themselves
  if (userID == serviceProviderID) {
    res.json({
      status: "Failed",
      message: "You cannot review yourself",
    });
  } else {
    //check if user exists
    await User.findOne({ _id: userID })
      .then(async (response) => {
        if (response) {
          //check if job provider exists
          await ServiceProvider.findOne({
            $and: [{ provider: serviceProviderID }, { _id: serviceID }],
          })
            .then(async (response) => {
              if (response) {
                const newReview = new Review({
                  whoReviewed: userID,
                  serviceProvider: serviceProviderID,
                  createdAt: Date.now(),
                  reviewMessage,
                  rating,
                });

                await newReview
                  .save()
                  .then(async () => {
                    //get initial data

                    await ServiceProvider.findOne({ _id: serviceID })
                      .then(async (response) => {
                        if (response) {
                          //find average
                          const oldRating = response.rating;
                          const newRating = (oldRating + rating) / 2;

                          //update
                          await ServiceProvider.updateOne(
                            { _id: serviceID },
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
                            message: "Servie not found",
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
                  message: "Service provider not found",
                });
              }
            })
            .catch((err) => {
              console.log(err);
              res.json({
                status: "Failed",
                message: "Error occured while finding service provider",
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
  }
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
  const { userID, providerID } = req.body;
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
  const { userID } = req.body;

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
            .then(() => {
              res.json({
                status: "Success",
                message: "Successfully deleted",
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
  const { phoneNumber, userID } = req.body;
  const serviceProviderID = req.params.id;
  const amount = 1;

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
            "https://tinypesa.com/api/v1/express/initialize?https://investment-app-backend.herokuapp.com/payments/registration-callback";
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
                phoneNumber +
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
  console.log(req.body.Body);

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
    .then((response) => {
      console.log(response);
    })
    .catch((err) => {
      console.log(err);
    });

  const mailOptions = {
    from: process.env.AUTH_EMAIL,
    to: "newtontingo@gmail.com",
    subject: "Service promotion payment alert",
    html: `<p><strong>${phoneNumber}</strong> has paid <strong>KSH. ${amount}</strong> as registration fee in your investment mobile application</p>`,
  };

  await transporter
    .sendMail(mailOptions)
    .then((response) => {
      console.log(response);
    })
    .catch((err) => {
      console.log(err);
    });
};

module.exports = router;
