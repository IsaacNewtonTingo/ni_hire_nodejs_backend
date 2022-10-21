const express = require("express");
const router = express.Router();
require("dotenv").config();
const bcrypt = require("bcrypt");
var nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const request = require("request");
let unirest = require("unirest");

const datetime = require("node-datetime");

const User = require("../models/user");
const UserVerification = require("../models/user-verification");
const PasswordReset = require("../models/password-reset");

const { PromotedUser } = require("../models/promote-user");
const { ServiceProvider } = require("../models/service-provider");
const { ProfileVisit } = require("../models/profile-visits");
const { BugReport } = require("../models/bug-report");
const { EmailChange } = require("../models/email-change");
const { PremiumUser } = require("../models/premium-user");

const currentUrl = "https://ni-hire-backend.herokuapp.com/";

let transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASS,
  },
});

//signup
router.post("/signup", async (req, res) => {
  let {
    firstName,
    lastName,
    email,
    phoneNumber,
    password,
    generalPromotedTitle,
  } = req.body;

  if (!firstName || !lastName || !email || !phoneNumber || !password) {
    res.json({
      status: "Failed",
      message: "All fields are required",
    });
  } else if (!/^[a-zA-Z ]*$/.test(firstName, lastName)) {
    res.json({
      status: "Failed",
      message: "Invalid name format",
    });
  } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    res.json({
      status: "Failed",
      message: "Invalid email",
    });
  } else if (password.length < 8) {
    res.json({
      status: "Failed",
      message: "Password is too short",
    });
  } else {
    await User.find({ $or: [{ email }, { phoneNumber }] })
      .then((result) => {
        if (result.length) {
          res.json({
            status: "Failed",
            message: "User with the given email/phone number already exists",
          });
        } else {
          const salt = 10;
          bcrypt
            .hash(password, salt)
            .then((hashedPassword) => {
              const newUser = new User({
                firstName,
                lastName,
                email,
                phoneNumber,
                password: hashedPassword,
                verified: false,

                bio: "",
                location: "",
                profilePicture: "",
                isFeatured: false,
                generalPromotedTitle: generalPromotedTitle
                  ? generalPromotedTitle
                  : "",
                dateFeatured: "",
              });
              newUser
                .save()
                .then((result) => {
                  //Send email
                  sendVerificationEmail(result, res);
                })
                .catch((err) => {
                  res.json({
                    status: "Failed",
                    message: "Error occured while creating account",
                  });
                });
            })
            .catch((err) => {
              res.json({
                status: "Failed",
                message: "Error occured while hashing password",
              });
            });
        }
      })
      .catch((err) => {
        res.json({
          status: "Failed",
          message: "Erro occured when checking email and phoneNumber",
        });
      });
  }
});

const sendVerificationEmail = ({ _id, email }, res) => {
  const uniqueString = uuidv4() + _id;
  const mailOptions = {
    from: process.env.AUTH_EMAIL,
    to: email,
    subject: "Verify your email",
    html: `<p>Verify your email to complete your signup process.</p><p>Link <b>expires in 6hrs.</b></p><p>Press <a href=${
      currentUrl + "user/verify/" + _id + "/" + uniqueString
    }> here </a>to proceed </p>`,
  };

  const saltRounds = 10;
  bcrypt
    .hash(uniqueString, saltRounds)
    .then((hashedUniqueString) => {
      const newVerification = new UserVerification({
        userId: _id,
        uniqueString: hashedUniqueString,
        createdAt: Date.now(),
        expiresAt: Date.now() + 21600000,
      });
      newVerification
        .save()
        .then(() => {
          transporter
            .sendMail(mailOptions)
            .then(() => {
              res.json({
                status: "Pending",
                message: "Verification email sent",
              });
            })
            .catch((err) => {
              res.json({
                status: "Failed",
                message: "Error occured sending verification email",
              });
            });
        })
        .catch((err) => {
          res.json({
            status: "Failed",
            message: "Couldn't save verification email data",
          });
        });
    })
    .catch((err) => {
      res.json({
        status: "Failed",
        message: "Error occured hashing email data",
      });
    });
};

router.get("/verify/:userId/:uniqueString", (req, res) => {
  let { userId, uniqueString } = req.params;

  UserVerification.find({ userId })
    .then((result) => {
      if (result.length > 0) {
        const { expiresAt } = result[0];
        const hashedUniqueString = result[0].uniqueString;

        if (expiresAt < Date.now()) {
          UserVerification.deleteOne({ userId })
            .then((result) => {
              User.deleteOne({ _id: userId })
                .then(() => {
                  let message = "Link has expired. Signup again";
                  res.redirect(`/user/verified/?error=true&message=${message}`);
                })
                .catch((err) => {
                  console.log(err);
                  let message = "Clearing user data failed";
                  res.redirect(`/user/verified/?error=true&message=${message}`);
                });
            })
            .catch((err) => {
              console.log(err);
              let message =
                "An error occured while clearing expired verification data";
              res.redirect(`/user/verified/?error=true&message=${message}`);
            });
        } else {
          bcrypt
            .compare(uniqueString, hashedUniqueString)
            .then((result) => {
              if (result) {
                User.updateOne({ _id: userId }, { verified: true })
                  .then(() => {
                    UserVerification.deleteOne({ userId })
                      .then(() => {
                        res.sendFile(
                          path.join(__dirname, "../views/verified.html")
                        );
                      })
                      .catch((err) => {
                        console.log(err);
                        let message =
                          "An error occured while deleting verified user";
                        res.redirect(
                          `/user/verified/?error=true&message=${message}`
                        );
                      });
                  })
                  .catch((err) => {
                    console.log(err);
                    let message =
                      "An error occured while updating user records";
                    res.redirect(
                      `/user/verified/?error=true&message=${message}`
                    );
                  });
              } else {
                let message = "Invalid verification details. Check your inbox";
                res.redirect(`/user/verified/?error=true&message=${message}`);
              }
            })
            .catch((err) => {
              let message = "An error occured while comparing unique strings";
              res.redirect(`/user/verified/?error=true&message=${message}`);
            });
        }
      } else {
        let message =
          "Account record doesn't exists or has been verified already. Please signup or login";
        res.redirect(`/user/verified/?error=true&message=${message}`);
      }
    })
    .catch((err) => {
      console.log(err);
      let message = "An error occured whilechecking verified email";
      res.redirect(`/user/verified/?error=true&message=${message}`);
    });
});

router.get("/verified", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/verified.html"));
});

//login
router.post("/signin", (req, res) => {
  console.log("Connected");
  let { email, password } = req.body;

  if (!email || !password) {
    res.json({
      status: "Failed",
      message: "All fields are required",
    });
  } else {
    User.find({ email })
      .then((data) => {
        if (data.length) {
          if (!data[0].verified) {
            res.json({
              status: "Failed",
              message: "Email hasn't been verified",
            });
          } else {
            const hashedPassword = data[0].password;
            bcrypt
              .compare(password, hashedPassword)
              .then(async (result) => {
                if (result) {
                  console.log("Hurray");
                  res.json({
                    status: "Success",
                    message: "Login successfull",
                    data: data,
                  });
                } else {
                  res.json({
                    status: "Failed",
                    message: "Invalid password",
                  });
                }
              })
              .catch((err) => {
                console.log(err);
                res.json({
                  status: "Failed",
                  message: "Error occured while comparing passwords",
                });
              });
          }
        } else {
          res.json({
            status: "Failed",
            message: "Invalid credentials entered",
          });
        }
      })
      .catch((err) => {
        res.json({
          status: "Failed",
          message: "Error occured checking existing user",
        });
      });
  }
});

router.post("/request-password-reset", (req, res) => {
  const { email, redirectUrl } = req.body;

  if (!email) {
    res.json({
      status: "Failed",
      message: "Please input email",
    });
  } else {
    User.find({ email })
      .then((data) => {
        if (data.length) {
          if (!data[0].verified) {
            res.json({
              status: "Failed",
              message: "Email hasn't been verified yet. Check your email",
            });
          } else {
            sendResetEmail(data[0], redirectUrl, res);
          }
        } else {
          res.json({
            status: "Failed",
            message: "No account with the given email exists",
          });
        }
      })
      .catch((err) => {
        res.json({
          status: "Failed",
          message: "Error occured whie checking existing user",
        });
      });
  }
});

const sendResetEmail = ({ _id, email }, redirectUrl, res) => {
  const resetString = uuidv4() + _id;

  PasswordReset.deleteMany({ userId: _id })
    .then((result) => {
      const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: "Reset your password",
        // html: `<p>You have initiated a reset password process.</p><p>Link <b>expires in 60 minutes.</b></p><p>Press <a href=${
        //   redirectUrl + "/" + _id + "/" + resetString
        // }> here </a>to proceed </p>`,
        html: `<p>You have initiated a reset password process.</p><p>Link <b>expires in 60 minutes</p> <p>Here is your secret code:</p><p><strong>${resetString}</strong><br/>Enter the code in the app, with your new password.</p>`,
      };

      const saltRounds = 10;
      bcrypt
        .hash(resetString, saltRounds)
        .then((hashedResetString) => {
          const newPasswordReset = new PasswordReset({
            userId: _id,
            resetString: hashedResetString,
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000,
          });

          newPasswordReset
            .save()
            .then(() => {
              transporter
                .sendMail(mailOptions)
                .then(() => {
                  res.json({
                    status: "Pending",
                    message: _id,
                  });
                })
                .catch((err) => {
                  res.json({
                    status: "Failed",
                    message: "Error sending password reset email",
                  });
                });
            })
            .catch((err) => {
              console.log(err);
              res.json({
                status: "Failed",
                message: "Error occured saving reset record",
              });
            });
        })
        .catch((err) => {
          res.json({
            status: "Failed",
            message: "Error while hashing password reset data",
          });
        });
    })
    .catch((err) => {
      console.log(err);
      res.json({
        status: "Failed",
        message: "Error while clearing past records",
      });
    });
};

router.post("/reset-password", (req, res) => {
  let { userId, resetString, newPassword } = req.body;
  PasswordReset.find({ userId })
    .then((result) => {
      if (result.length > 0) {
        const { expiresAt } = result[0];
        const hashedResetString = result[0].resetString;

        if (expiresAt < Date.now()) {
          PasswordReset.deleteOne({ userId })
            .then(() => {
              res.json({
                status: "Failed",
                message: "Password reset link has expired",
              });
            })
            .catch((err) => {
              console.log(err);
              res.json({
                status: "Failed",
                message: "Failed to delete outdated password reset record",
              });
            });
        } else {
          bcrypt
            .compare(resetString, hashedResetString)
            .then((result) => {
              if (result) {
                const saltRounds = 0;
                bcrypt
                  .hash(newPassword, saltRounds)
                  .then((hashedNewPassword) => {
                    User.updateOne(
                      { _id: userId },
                      { password: hashedNewPassword }
                    )
                      .then(() => {
                        PasswordReset.deleteOne({ userId })
                          .then(() => {
                            res.json({
                              status: "Success",
                              message:
                                "You have successfully reset your password",
                            });
                          })
                          .catch((err) => {
                            console.log(err);
                            res.json({
                              status: "Failed",
                              message:
                                "An error occured while finalizing password reset",
                            });
                          });
                      })
                      .catch((err) => {
                        console.log(err);
                        res.json({
                          status: "Failed",
                          message: "Updating user password failed",
                        });
                      });
                  })
                  .catch((err) => {
                    console.log(err);
                    res.json({
                      status: "Failed",
                      message: "An error occured while hashing new password",
                    });
                  });
              } else {
                res.json({
                  status: "Failed",
                  message: "Invalid password reset details passed",
                });
              }
            })
            .catch((err) => {
              console.log(err);
              res.json({
                status: "Failed",
                message: "Comparing password reset string failed failed",
              });
            });
        }
      } else {
        res.json({
          status: "Failed",
          message: "Password reset request not found",
        });
      }
    })
    .catch((err) => {
      console.log(err);
      res.json({
        status: "Failed",
        message: "Checking for checking reset record failed",
      });
    });
});

router.post("/update-phone-number", (req, res) => {
  const { phoneNumberUsed, userID } = req.body;

  if (!phoneNumberUsed) {
    res.json({
      status: "Failed",
      message: "Please enter a phone number",
    });
  } else if (!userID) {
    res.json({
      status: "Failed",
      message: "Invalid user ID",
    });
  } else {
    User.find({ userID })
      .then((response) => {
        if (response.length > 0) {
          //user found
          User.updateOne(
            {
              _id: userID,
            },
            { phoneNumber: phoneNumberUsed }
          )
            .then((response) => {
              res.json({
                status: "Success",
                message: "Phone number updated successfully",
              });
            })
            .catch((err) => {
              console.log(err);
              res.json({
                status: "Failed",
                message: "Error occured while updating phone number",
              });
            });
        } else {
          //user not found
          res.json({
            status: "Failed",
            message: "No user records found",
          });
        }
      })
      .catch((err) => {
        console.log(err);
        res.json({
          status: "Failed",
          message: "Error occured while validating user records",
        });
      });
  }
});

//get featured users
router.get("/featured-users", async (req, res) => {
  const services = await User.find({ isFeatured: true });
  res.send(services);
});

//get user data
router.get("/get-user-data/:id", async (req, res) => {
  const userID = req.params.id;
  if (userID.match(/^[0-9a-fA-F]{24}$/)) {
    await User.findById(userID)
      .then((response) => {
        res.json({
          data: response,
        });
      })
      .catch((err) => {
        console.log(err);
        res.json({
          status: "Failed",
          message: "Error occured while getting user data",
        });
      });
  } else {
    res.json({
      status: "Failed",
      message: "Invalid user ID",
    });
  }
});

//edit profile
router.put("/update-profile/:id", async (req, res) => {
  const userID = req.params.id;
  const { password, email } = req.body;
  const filter = { _id: userID };

  //validate user
  if (!email || !password) {
    res.json({
      status: "Failed",
      message: "All fields are required",
    });
  } else {
    User.find({ email })
      .then((data) => {
        if (data.length) {
          const hashedPassword = data[0].password;
          bcrypt
            .compare(password, hashedPassword)
            .then(async (result) => {
              if (result) {
                await User.findOneAndUpdate(
                  filter,
                  {
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    phoneNumber: req.body.phoneNumber,
                    profilePicture: req.body.profilePicture,
                    bio: req.body.bio,
                    location: req.body.location,
                  },
                  {
                    new: true,
                  }
                )
                  .then((response) => {
                    res.json({
                      status: "Success",
                      message: "Profile updated successfully",
                      data: response,
                    });
                  })
                  .catch((err) => {
                    console.log(err);
                    res.json({
                      status: "Failed",
                      message: "Error occured while updating user",
                    });
                  });
              } else {
                res.json({
                  status: "Failed",
                  message: "Invalid password",
                });
              }
            })
            .catch((err) => {
              console.log(err);
              res.json({
                status: "Failed",
                message: "Error occured while comparing passwords",
              });
            });
        } else {
          res.json({
            status: "Failed",
            message: "Invalid credentials entered",
          });
        }
      })
      .catch((err) => {
        res.json({
          status: "Failed",
          message: "Error occured checking existing user",
        });
      });
  }
});

//delete profile
//delete my services
//delete my reviews
router.delete("/delete-profile/:id", async (req, res) => {
  const userID = req.params.id;
  const { password } = req.body;

  //check if user exists
  await User.findOne({ _id: userID })
    .then(async (response) => {
      if (response) {
        //user is available
        //validate user
        const hashedPassword = response[0].password;
        await bcrypt
          .compare(password, hashedPassword)
          .then(async (response) => {
            if (response) {
              //proceed to delete user
              await User.deleteOne({ _id: userID })
                .then(async () => {
                  //check if user has services and delete
                  await ServiceProvider.findOneAndDelete({ provider: userID })
                    .then(async (response) => {
                      if (response) {
                        res.json({
                          status: "Success",
                          message:
                            "User deleted successfully.All your services have also been deleted",
                        });
                      } else {
                        res.json({
                          status: "Success",
                          message:
                            "User deleted successfully.You had no services",
                        });
                      }
                    })
                    .catch((err) => {
                      console.log(err);
                      res.json({
                        status: "Failed",
                        message: "Error occured while getting services records",
                      });
                    });
                })
                .catch((err) => {
                  console.log(err);
                  res.json({
                    status: "Failed",
                    message: "Error occured while deleting user",
                  });
                });
            } else {
              res.json({
                status: "Failed",
                message: "Wrong password",
              });
            }
          })
          .catch((err) => {
            console.log(err);
            res.json({
              status: "Failed",
              message: "Error occured while comparing passwords",
            });
          });
      } else {
        //user not found
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

//promote profile
router.post("/promote-profile/:id", async (req, res) => {
  const { phoneNumber } = req.body;
  const userID = req.params.id;
  const amount = 1;

  //check if user with id and phonenumber exists
  await User.findOne({
    $and: [{ _id: userID }, { phoneNumber: phoneNumber }],
  })
    .then((response) => {
      if (response) {
        //perform stk push
        const url =
          "https://tinypesa.com/api/v1/express/initialize?https://ni-hire-backend.herokuapp.com/user/user-promotion-callback";
        request(
          {
            url: url,
            method: "POST",
            headers: {
              Apikey: process.env.TINY_PESA_API_KEY_DEPOSIT,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body:
              "amount=" + amount + "&msisdn=" + phoneNumber + "&account_no=200",
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
      } else {
        res.json({
          status: "Failed",
          message: "No user found. Check your phone number again",
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

router.post("/user-promotion-callback", async (req, res) => {
  if (req.body.Body.stkCallback.ResultCode == 0) {
    //Payment is successful
    const phoneNumber = req.body.Body.stkCallback.Msisdn;
    const amount = req.body.Body.stkCallback.Amount;

    const newPromotedService = new PromotedUser({
      datePromoted: Date.now(),
      expiryDate: Date.now() + 604800000,
      amountPaid: amount,
      phoneNumber: phoneNumber,
    });

    await newPromotedService
      .save()
      .then(async () => {
        await User.findOneAndUpdate({ phoneNumber }, { isFeatured: true })
          .then(() => {})
          .catch((err) => {
            console.log(err);
          });
      })
      .catch((err) => {
        console.log(err);
      });

    const mailOptions = {
      from: process.env.AUTH_EMAIL,
      to: "newtontingo@gmail.com",
      subject: "User promotion payment alert",
      html: `<p><strong>${phoneNumber}</strong> has paid <strong>KSH. ${amount}</strong> as user promotion at niHire app</p>`,
    };

    await transporter.sendMail(mailOptions).catch((err) => {
      console.log(err);
    });
  } else {
    //Payment unsuccessfull
    console.log("Request not completed/Cancelled");
  }
});

//Add profile visits
router.post("/add-profile-visits/:id", async (req, res) => {
  const currentUserID = req.params.id;
  const { providerID } = req.query;

  if (!currentUserID || !providerID) {
    res.json({
      status: "Failed",
      message: "Missing parameters",
    });
  } else if (currentUserID == providerID) {
    res.json({
      status: "Failed",
      message: "Operation prohibited",
    });
  } else {
    //Check if current user is available
    await User.findOne({ _id: currentUserID })
      .then(async (response) => {
        if (response) {
          //Current user is available
          //Check if provider is available
          await User.findOne({ _id: providerID })
            .then(async (response) => {
              if (response) {
                //Provider is available
                //Check if they had already visited
                await ProfileVisit.findOneAndDelete({
                  $and: [
                    { whoVisited: currentUserID },
                    { whoWasVisited: providerID },
                  ],
                })
                  .then(async (response) => {
                    const newProfileVisit = new ProfileVisit({
                      whoVisited: currentUserID,
                      whoWasVisited: providerID,
                      dateVisited: Date.now() + 10800000,
                    });

                    if (response) {
                      //Deletion has occured
                      //Add new visit

                      await newProfileVisit
                        .save()
                        .then(() => {
                          res.json({
                            status: "Success",
                            message:
                              "Deleted existing data and added to profile visits successfully",
                          });
                        })
                        .catch((err) => {
                          console.log(err);
                          res.json({
                            status: "Failed",
                            message: "Error occured while saving profile visit",
                          });
                        });
                    } else {
                      //nothing to delete
                      //Freshly data to add

                      await newProfileVisit
                        .save()
                        .then(() => {
                          res.json({
                            status: "Success",
                            message:
                              "Freshly added to profile visits successfully",
                          });
                        })
                        .catch((err) => {
                          console.log(err);
                          res.json({
                            status: "Failed",
                            message: "Error occured while saving profile visit",
                          });
                        });
                    }
                  })
                  .catch((err) => {
                    console.log(err);
                    res.json({
                      status: "Failed",
                      message: "Error occured while deleting",
                    });
                  });
              } else {
                //provider not found
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
                message: "Error occured while getting service provider records",
              });
            });
        } else {
          //Current user not found
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
  }
});

//Get profile visits
router.get("/get-profile-visits/:id", async (req, res) => {
  const currentUserID = req.params.id;

  if (!currentUserID) {
    res.json({
      status: "Failed",
      message: "Missing parameters",
    });
  } else {
    //Check if user exists
    await User.findOne({ _id: currentUserID }).then(async (response) => {
      if (response) {
        //User exists
        //Check if user is premium
        const isPremiumUser = response.isFeatured;

        await ProfileVisit.find({
          whoWasVisited: currentUserID,
        })
          .populate("whoVisited")
          .populate("whoWasVisited")

          .then(async (response) => {
            if (isPremiumUser === false) {
              //None premium users
              res.json({
                data: response.map((response) => ({
                  whoVisited: response.whoVisited.firstName,
                })),
              });
            } else {
              //Premium data
              res.json({
                data: response.map((response) => ({
                  _id: response.whoVisited._id,
                  firstName: response.whoVisited.firstName,
                  lastName: response.whoVisited.lastName,
                  email: response.whoVisited.email,
                  phoneNumber: response.whoVisited.phoneNumber,
                  bio: response.whoVisited.bio,
                  location: response.whoVisited.location,
                  profilePicture: response.whoVisited.profilePicture,
                })),
              });
            }
          })
          .catch((err) => {
            console.log(err);
            res.json({
              status: "Failed",
              message: "Error occured while getting profile visits",
            });
          });
      } else {
        //User doesn't exist
        res.json({
          status: "Failed",
          message: "User not found",
        });
      }
    });
  }
});

//Bug report
router.post("/bug-report/:id", async (req, res) => {
  const userID = req.params.id;
  const { message } = req.body;

  //check if user exists
  await User.findOne({ _id: userID })
    .then(async (response) => {
      if (response) {
        //user found
        const userName = response.firstName + " " + response.lastName;
        const email = response.email;
        const phoneNumber = response.phoneNumber;

        //add report
        const newBugReport = new BugReport({
          whoReported: userID,
          message: message,
          reportDate: Date.now(),
        });

        await newBugReport
          .save()
          .then(async () => {
            //send email
            const mailOptions = {
              from: process.env.AUTH_EMAIL,
              to: "newtontingo@gmail.com",
              subject: "Bug report",
              html: `<p>${message}</p>
                      <br/>
                      <br/>
                      <p>Name:<strong>${userName}</strong></p>
                      <p>Phone number:<strong>${phoneNumber}</strong></p>
                      <p>Email:<strong>${email}</strong></p>
                      `,
            };

            await transporter
              .sendMail(mailOptions)
              .then(() => {
                res.json({
                  status: "Success",
                  message: "Reported successfully",
                });
              })
              .catch((err) => {
                console.log(err);
                res.json({
                  status: "Failed",
                  message: "Error occured while sending bug report email.",
                });
              });
          })
          .catch((err) => {
            console.log(err);
            res.json({
              status: "Failed",
              message: "Error occured while saving bug report",
            });
          });
      } else {
        //user not found
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
        message: "Error occured while checking user records",
      });
    });
});

//edit email
router.post("/edit-email/:id", async (req, res) => {
  const userID = req.params.id;
  const { newEmail, password } = req.body;

  //check if user exists
  await User.findOne({ _id: userID })
    .then(async (response) => {
      if (response) {
        //user found
        //confirm password
        const hashedPassword = response.password;
        bcrypt
          .compare(password, hashedPassword)
          .then(async (response) => {
            if (response) {
              //Check if email has been used
              await User.find({ email: newEmail })
                .then(async (response) => {
                  if (response.length > 0) {
                    //email exists
                    res.json({
                      status: "Failed",
                      message:
                        "Email provided has already been used. Try a different one",
                    });
                  } else {
                    //email doesnt exist
                    sendChangeEmailRequest({ userID, newEmail }, res);
                  }
                })
                .catch((err) => {
                  console.log(err);
                  res.json({
                    status: "Failed",
                    message: "Error occured while checking email records",
                  });
                });
            } else {
              //invalid pass
              res.json({
                status: "Failed",
                message: "Invalid password",
              });
            }
          })
          .catch((err) => {
            console.log(err);
            res.json({
              status: "Failed",
              message: "Error occured whilecomparing passwords",
            });
          });
      } else {
        //user not found
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
        message: "Error occured while searching user",
      });
    });
});

const sendChangeEmailRequest = ({ userID, newEmail }, res) => {
  const uniqueString = uuidv4() + userID;

  const mailOptions = {
    from: process.env.AUTH_EMAIL,
    to: newEmail,
    subject: "Verify your email",
    html: `<p>Verify your email to complete your email change request process.</p><p>Link <b>expires in 6hrs.</b></p><p>Press <a href=${
      currentUrl + "user/change-email/" + userID + "/" + uniqueString
    }> here </a>to proceed </p>`,
  };

  const saltRounds = 10;
  bcrypt
    .hash(uniqueString, saltRounds)
    .then(async (hashedUniqueString) => {
      const newEmailChange = new EmailChange({
        userID: userID,
        newEmail: newEmail,
        uniqueString: hashedUniqueString,
        createdAt: Date.now(),
        expiresAt: Date.now() + 21600000,
      });

      //first check if there was a previous request
      await EmailChange.find({
        userID,
      })

        .then(async (response) => {
          if (response.length > 0) {
            //there were previous requests
            await EmailChange.deleteMany({
              userID,
            }).then(() => {
              newEmailChange
                .save()
                .then(() => {
                  transporter
                    .sendMail(mailOptions)
                    .then(() => {
                      res.json({
                        status: "Pending",
                        message:
                          "Verification email sent.Check your mailbox to verify new email",
                      });
                    })
                    .catch((err) => {
                      res.json({
                        status: "Failed",
                        message: "Error occured sending verification email",
                      });
                    });
                })
                .catch((err) => {
                  res.json({
                    status: "Failed",
                    message: "Couldn't save verification email data",
                  });
                });
            });
          } else {
            //noprevious req
            newEmailChange
              .save()
              .then(() => {
                transporter
                  .sendMail(mailOptions)
                  .then(() => {
                    res.json({
                      status: "Pending",
                      message:
                        "Verification email sent.Check your mailbox to verify new email",
                    });
                  })
                  .catch((err) => {
                    res.json({
                      status: "Failed",
                      message: "Error occured sending verification email",
                    });
                  });
              })
              .catch((err) => {
                res.json({
                  status: "Failed",
                  message: "Couldn't save verification email data",
                });
              });
          }
        })
        .catch((err) => {
          console.log(err);
          res.json({
            status: "Failed",
            message: "Error occured checking email change records",
          });
        });
    })
    .catch((err) => {
      res.json({
        status: "Failed",
        message: "Error occured hashing email data",
      });
    });
};

router.get("/change-email/:userID/:uniqueString", (req, res) => {
  let { userID, uniqueString } = req.params;

  EmailChange.find({ userID })
    .then((result) => {
      if (result.length > 0) {
        const { expiresAt } = result[0];
        const hashedUniqueString = result[0].uniqueString;
        const newEmail = result[0].newEmail;

        if (expiresAt < Date.now()) {
          EmailChange.deleteOne({ userID })
            .then((result) => {
              User.deleteOne({ _id: userID })
                .then(() => {
                  let message = "Link has expired. Change email again";
                  res.redirect(`/user/verified/?error=true&message=${message}`);
                })
                .catch((err) => {
                  console.log(err);
                  let message = "Clearing user data failed";
                  res.redirect(`/user/verified/?error=true&message=${message}`);
                });
            })
            .catch((err) => {
              console.log(err);
              let message =
                "An error occured while clearing expired verification data";
              res.redirect(`/user/verified/?error=true&message=${message}`);
            });
        } else {
          bcrypt
            .compare(uniqueString, hashedUniqueString)
            .then((result) => {
              if (result) {
                User.updateOne({ _id: userID }, { email: newEmail })
                  .then(() => {
                    EmailChange.deleteOne({ userID })
                      .then(() => {
                        res.sendFile(
                          path.join(__dirname, "../views/verified.html")
                        );
                      })
                      .catch((err) => {
                        console.log(err);
                        let message =
                          "An error occured while deleting verified user";
                        res.redirect(
                          `/user/verified/?error=true&message=${message}`
                        );
                      });
                  })
                  .catch((err) => {
                    console.log(err);
                    let message =
                      "An error occured while updating user records";
                    res.redirect(
                      `/user/verified/?error=true&message=${message}`
                    );
                  });
              } else {
                let message = "Invalid verification details. Check your inbox";
                res.redirect(`/user/verified/?error=true&message=${message}`);
              }
            })
            .catch((err) => {
              let message = "An error occured while comparing unique strings";
              res.redirect(`/user/verified/?error=true&message=${message}`);
            });
        }
      } else {
        let message =
          "Account record doesn't exists or has been verified already. Please signup or login";
        res.redirect(`/user/verified/?error=true&message=${message}`);
      }
    })
    .catch((err) => {
      console.log(err);
      let message = "An error occured whilechecking verified email";
      res.redirect(`/user/verified/?error=true&message=${message}`);
    });
});

//edit phone number
router.post("/edit-phone-number/:id", async (req, res) => {
  const { phoneNumber, password } = req.body;
  const userID = req.params.id;

  //check if user exists

  await User.findOne({ _id: userID })
    .then((response) => {
      if (response) {
        //user exists
        const hashedPassword = response.password;

        bcrypt
          .compare(password, hashedPassword)
          .then(async (response) => {
            if (response) {
              //correct pass
              //ensure no one has the new number

              User.find({ phoneNumber })
                .then(async (response) => {
                  if (response.length > 0) {
                    //number is registered
                    res.json({
                      status: "Failed",
                      message: "Phone number already registered. Use another",
                    });
                  } else {
                    //not registered
                    //change phone number
                    await User.updateOne(
                      { _id: userID },
                      { phoneNumber: phoneNumber }
                    )
                      .then(() => {
                        res.json({
                          status: "Success",
                          message: "Phone number updated successfully",
                        });
                      })
                      .catch((err) => {
                        console.log(err);
                        res.json({
                          status: "Failed",
                          message:
                            "Error occured while updating user phone number",
                        });
                      });
                  }
                })
                .catch((err) => {
                  console.log(err);
                  res.json({
                    status: "Failed",
                    message: "Error occured while checking existing records",
                  });
                });
            } else {
              //wrong password
              res.json({
                status: "Failed",
                message: "Incorrect password",
              });
            }
          })
          .catch((err) => {
            console.log(err);
            res.json({
              status: "Failed",
              message: "Error occured while comparing passwords",
            });
          });
      } else {
        //user doesnt exist
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
        message: "Error occured while checking user records",
      });
    });
});

const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;

function access(req, res, next) {
  let url =
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  let auth = new Buffer.from(consumerKey + ":" + consumerSecret).toString(
    "base64"
  );
  request(
    {
      url: url,
      headers: {
        Authorization: "Basic " + auth,
      },
    },
    (error, response, body) => {
      if (error) {
        console.log(error);
      } else {
        req.access_token = JSON.parse(body).access_token;
        next();
      }
    }
  );
}

router.get("/access-token", access, (req, res) => {
  res.status(200).json({ access_token: req.access_token });
});

//join premium
router.post("/join-premium/:id", access, async (req, res) => {
  const { phoneNumber, password } = req.body;
  const userID = req.params.id;

  //check if user exists
  await User.findOne({ _id: userID })
    .then((response) => {
      if (response) {
        //user found
        const hashedPassword = response.password;
        bcrypt
          .compare(password, hashedPassword)
          .then((response) => {
            if (response) {
              //correct pass
              let auth = "Bearer " + req.access_token;
              let datenow = datetime.create();
              const timestamp = datenow.format("YmdHMS");

              const password = new Buffer.from(
                "174379" +
                  "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919" +
                  timestamp
              ).toString("base64");
              request(
                {
                  url: "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
                  method: "POST",
                  headers: {
                    Authorization: auth,
                  },
                  json: {
                    BusinessShortCode: 174379,
                    Password: password,
                    Timestamp: timestamp,
                    TransactionType: "CustomerPayBillOnline",
                    Amount: 1,
                    PartyA: phoneNumber,
                    PartyB: 174379,
                    PhoneNumber: phoneNumber,
                    CallBackURL:
                      "https://ni-hire-backend.herokuapp.com/user/join-premium-response",
                    AccountReference: "CompanyXLTD",
                    TransactionDesc: "Payment of X",
                  },
                },
                function (error, response, body) {
                  if (error) {
                    console.log(error);
                  } else {
                    res.status(200).json(body);
                  }
                }
              );
            } else {
              //wrong pass
              res.json({
                status: "Failed",
                message: "Wrong password",
              });
            }
          })
          .catch((err) => {
            console.log(err);
            res.json({
              status: "Failed",
              message: "Error occured whiles comparing passwords",
            });
          });
      } else {
        //no user
        res.json({
          status: "Failed",
          message: "User not found",
        });
      }
    })
    .catch((err) => {
      res.json({
        status: "Failed",
        message: "Error occured while checking user records",
      });
    });
});

//callback
router.post("/join-premium-response", (req, res) => {
  console.log(req.body.Body.stkCallback.CallbackMetadata.Item[3].Value);

  //Payment is successful
  if (req.body.Body.stkCallback.ResultCode == 0) {
    //pass amount,phoneNumber to this function
    const phoneNumber =
      req.body.Body.stkCallback.CallbackMetadata.Item[3].Value;
    const amount = req.body.Body.stkCallback.CallbackMetadata.Item[0].Value;

    console.log(req.body.Body.stkCallback.CallbackMetadata);

    savePaymentToDB({ phoneNumber, amount });
  } else {
    //Payment unsuccessfull
    console.log("Cacelled");
  }
});

const savePaymentToDB = async ({ amount, phoneNumber }) => {
  //find user with the phone number
  console.log("Saving to db");
  console.log(phoneNumber);
  await User.findOne({ phoneNumber: phoneNumber })
    .then(async (response) => {
      if (response) {
        //user found
        const user = response._id;

        const newPremiumUser = new PremiumUser({
          datePromoted: Date.now(),
          dateExpiring: Date.now() + 604800000,
          amount: amount,
          user: user,
        });

        await newPremiumUser
          .save()
          .then((response) => {
            console.log(response);
          })
          .catch((err) => {
            console.log(err);
          });

        await User.updateOne(
          { _id: user },
          {
            isFeatured: true,
            dateFeatured: Date.now(),
            dateExpiring: Date.now() + 604800000,
          }
        ).catch((err) => {
          console.log(err);
        });

        await ServiceProvider.updateMany(
          { provider: user },
          {
            isPromoted: true,
            datePromoted: Date.now(),
            dateExpiring: Date.now() + 604800000,
          }
        ).catch((err) => {
          console.log(err);
        });

        const mailOptions = {
          from: process.env.AUTH_EMAIL,
          to: "newtontingo@gmail.com",
          subject: "Premium user fee payment alert",
          html: `<p><strong>${phoneNumber}</strong> has paid <strong>KSH. ${amount}</strong> as premium user fee at niHire mobile</p>`,
        };

        await transporter
          .sendMail(mailOptions)
          .then((response) => {
            console.log(response);
          })
          .catch((err) => {
            console.log(err);
          });
      } else {
        //no user
        console.log("User not found");
      }
    })
    .catch((err) => {
      console.log(err);
    });
};

//get my previous transactions
router.get("/get-my-premium-records/:id", async (req, res) => {
  const userID = req.params.id;
  //check if user exists
  await User.findOne({ _id: userID })
    .then(async (response) => {
      if (response) {
        //user found
        //search for their data
        await PremiumUser.find({ user: userID })
          .then((response) => {
            if (response) {
              //records found
              res.send(response);
            } else {
              //No records
              res.json({
                status: "Failed",
                message: "User has no premium records",
              });
            }
          })
          .catch((err) => {
            console.log(err);
            res.json({
              status: "Failed",
              message: "Error occured finding premium records",
            });
          });
      } else {
        //user not found
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
        message: "Error occured while checking existing user records",
      });
    });
});

module.exports = router;
