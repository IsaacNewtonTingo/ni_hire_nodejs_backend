const { ServiceProvider } = require("../models/service-provider");
const User = require("../models/user");

User.updateMany(
  { dateExpiring: { $lt: Date.now() } },
  { isFeatured: false, dateFeatured: "", dateExpiring: "" }
)
  .then((response) => {
    if (response.modifiedCount > 0) {
      //found some records and updated
      console.log("Expired premium users found and updated");
    } else {
      //no records found
      console.log("No expired premium user records found");
    }
  })
  .catch((err) => {
    console.log(err);
  });

ServiceProvider.updateMany(
  { dateExpiring: { $lt: Date.now() } },
  { isPromoted: false, datePromoted: "", dateExpiring: "" }
)
  .then((response) => {
    if (response.modifiedCount > 0) {
      //found some records and updated
      console.log("Epired premium service provider records found and edited");
    } else {
      //no records found
      console.log("No expired premium service provider records found");
    }
  })
  .catch((err) => {
    console.log(err);
  });
