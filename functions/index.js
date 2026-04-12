const functions = require("firebase-functions");
const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("API WORKING");
});

// 🔥 IMPORTANT FIX: named function export (NOT generic api)
exports.backend = functions.https.onRequest(app);