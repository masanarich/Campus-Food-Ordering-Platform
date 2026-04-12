console.log("🔥 FIREBASE BOOT START");

const functions = require("firebase-functions");
const express = require("express");

const app = express();
app.use(express.json());

console.log("STEP 1 OK");

// test route FIRST (no imports yet)
app.get("/", (req, res) => {
  res.send("API WORKING");
});

console.log("STEP 2 OK");

// ONLY THEN load routes safely
try {
  console.log("LOADING MENU");
  app.use("/menu", require("./backend/routes/menu"));
  console.log("MENU OK");

  console.log("LOADING VENDOR");
  app.use("/vendors", require("./backend/routes/vendor"));
  console.log("VENDOR OK");

} catch (err) {
  console.error("🔥 ROUTE ERROR:", err);
}

// FINAL EXPORT (critical)
exports.api = functions.https.onRequest(app);

console.log("🔥 EXPORT DONE");