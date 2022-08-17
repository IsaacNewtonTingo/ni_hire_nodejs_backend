const express = require("express");
const router = express.Router();

const { Category } = require("../models/add-category");
const { Service } = require("../models/add-service");

router.post("/add-service", async (req, res) => {
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
          console.log(response);
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

module.exports = router;
