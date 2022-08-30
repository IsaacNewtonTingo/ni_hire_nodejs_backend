const express = require("express");
const router = express.Router();
require("dotenv").config();
const bcrypt = require("bcrypt");
var nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const request = require("request");

const User = require("../models/user");
const UserVerification = require("../models/user-verification");
const PasswordReset = require("../models/password-reset");
const { PromotedUser } = require("../models/promote-user");
const { ServiceProvider } = require("../models/service-provider");

const currentUrl = "https://ni-hire-backend.herokuapp.com/";

let transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASS,
  },
});

router.post("/signup", async (req, res) => {
  let { firstName, lastName, email, phoneNumber, password, location } =
    req.body;

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
                location,
                profilePicture: "",
                isFeatured: false,
                generalPromotedTitle: "",
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

router.post("/signin", (req, res) => {
  let { email, password } = req.body;
  email = email.trim();
  password = password.trim();

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
                  res.json({
                    status: "Success",
                    message: "Login successfull",
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
          "https://tinypesa.com/api/v1/express/initialize?https://49af-41-80-98-150.ap.ngrok.io/user/user-promotion-callback";
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

module.exports = router;
