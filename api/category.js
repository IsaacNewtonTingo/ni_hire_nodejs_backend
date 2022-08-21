const express = require("express");
const { Category } = require("../models/category");
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

router.get("/get-all-categories", async (req, res) => {
  try {
    const categories = await Category.find({});

    if (categories.length > 0) {
      res.json({
        status: "Success",
        message: "Categories found",
        categories: categories.map((categories) => ({
          categoryName: categories.categoryName,
          categoryImage: categories.categoryImage,
          categoryID: categories._id,
        })),
      });
    } else {
      res.json({
        status: "Failed",
        message: "No categories found",
      });
    }
  } catch (error) {
    console.log(error);
    res.json({
      status: "Failed",
      message: "Error occured while getting categories data",
    });
  }
});

module.exports = router;
