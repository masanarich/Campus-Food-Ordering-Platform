const functions = require("firebase-functions");
const express = require("express");

const app = express();

app.use(express.json());

// TEST ROUTE (must work first)
app.get("/", (req, res) => {
  res.send("API WORKING");
});

// MENU ROUTES
app.use("/menu", require("./backend/routes/menu"));

// VENDOR ROUTES
app.use("/vendors", require("./backend/routes/vendor"));

// EXPORT (IMPORTANT)
exports.api = functions.https.onRequest(app);