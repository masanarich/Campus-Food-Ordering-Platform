const functions = require("firebase-functions");
const express = require("express");

const app = express();
app.use(express.json());

console.log("APP START");

const menuRoutes = require("./backend/routes/menu");
const vendorRoutes = require("./backend/routes/vendor");

app.use("/menu", menuRoutes);
app.use("/vendors", vendorRoutes);

app.get("/", (req, res) => {
  res.send("API running");
});

exports.api = functions.https.onRequest(app);