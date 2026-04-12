const functions = require("firebase-functions");
const express = require("express");

const app = express();

app.use(express.json());

console.log("🔥 Firebase function starting...");

// ✅ FIXED PATHS
app.use("/menu", require("./routes/menu"));
app.use("/vendors", require("./routes/vendor"));

app.get("/", (req, res) => {
  res.send("API WORKING");
});

exports.api = functions.https.onRequest(app);