const functions = require("firebase-functions");
const express = require("express");

const app = express();

// IMPORTANT: keep minimal first
app.get("/", (req, res) => {
  res.send("API WORKING");
});

// ONLY ONE ROUTE FIRST (NO IMPORTS)
exports.api = functions.https.onRequest(app);