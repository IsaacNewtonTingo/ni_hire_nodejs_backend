const express = require("express");
const { Category } = require("../models/add-category");
const router = express.Router();

router.post("/add-category", async (req, res) => {
  const { categoryName } = req.body;

  if (!categoryName) {
    res.json({
      status: "Failed",
      message: "Category name is missing",
    });
  } else {
    const newCategory = new Category({
      categoryName: categoryName,
      categoryImage: "",
    });

    await newCategory
      .save()
      .then(() => {
        res.json({
          status: "Success",
          message: "Category added successfully",
        });
      })
      .catch((err) => {
        console.log(err);
        res.json({
          status: "Failed",
          message: "Error occured while adding category",
        });
      });
  }
});

module.exports = router;
