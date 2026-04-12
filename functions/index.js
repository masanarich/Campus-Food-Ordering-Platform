const functions = require("firebase-functions");
const express = require("express");

const app = express();
app.use(express.json());

console.log("APP START");

app.get("/", (req, res) => {
  res.send("API running");
});

app.use("/menu", require("./backend/routes/menu"));
app.use("/vendors", require("./backend/routes/vendor"));

// 🔥 CRITICAL: MUST BE LAST LINE
const api = functions.https.onRequest(app);

exports.api = api;