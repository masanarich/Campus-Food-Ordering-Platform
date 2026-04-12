/*const functions = require("firebase-functions");
const express = require("express");

const app = express();

// IMPORTANT: keep minimal first
app.get("/", (req, res) => {
  res.send("API WORKING");
});

// ONLY ONE ROUTE FIRST (NO IMPORTS)
exports.api = functions.https.onRequest(app);*/
console.log("🔥 FIREBASE START");

const functions = require("firebase-functions");

console.log("STEP 1 OK");

const express = require("express");
console.log("STEP 2 OK");

const app = express();

app.get("/", (req, res) => {
  res.send("WORKING");
});

console.log("STEP 3 OK");

// 🔥 VERY IMPORTANT: export FIRST (no routes, no imports)
exports.api = functions.https.onRequest(app);

console.log("STEP 4 EXPORT DONE");