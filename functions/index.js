/*const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");

admin.initializeApp(); // 🔥 IMPORTANT FIX

const app = express();
app.use(express.json());

console.log("STARTING APP");

const menuRoutes = require("./backend/routes/menu");
const vendorRoutes = require("./backend/routes/vendor");

app.use("/menu", menuRoutes);
app.use("/vendors", vendorRoutes);

app.get("/", (req, res) => {
  res.send("API is running");
});

exports.api = functions.https.onRequest(app);*/
console.log("BOOT 1");

const express = require("express");
const app = express();

console.log("BOOT 2");

try {
  console.log("LOADING MENU");
  require("./backend/routes/menu");
  console.log("MENU OK");

  console.log("LOADING VENDOR");
  require("./backend/routes/vendor");
  console.log("VENDOR OK");

} catch (err) {
  console.error("🔥 CRASH HERE:", err);
}

console.log("BOOT DONE");