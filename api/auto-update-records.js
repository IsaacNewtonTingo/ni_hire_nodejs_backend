const { ServiceProvider } = require("../models/service-provider");
const User = require("../models/user");

User.updateMany(
  { dateExpiring: { $lt: Date.now() } },
  { isFeatured: false, dateFeatured: "", dateExpiring: "" }
)
  .then((response) => {
    if (response.modifiedCount > 0) {
      //found some records and updated
      console.log("Outdated records found");
    } else {
      //no records found
      console.log("No outdated records found");
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
      console.log("Outdated records found and edited");
    } else {
      //no records found
      console.log("No outdated records found");
    }
  })
  .catch((err) => {
    console.log(err);
  });
