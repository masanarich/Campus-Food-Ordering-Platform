/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

/*const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");*/

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
//...setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

/*const functions = require("firebase-functions");
const express = require("express");

const app = express();
app.use(express.json());

console.log("Firebase function starting...");

// ✅ FIXED PATHS
const menuRoutes = require("./backend/routes/menu");
const vendorRoutes = require("./backend/routes/vendor");

app.use("/menu", menuRoutes);
app.use("/vendors", vendorRoutes);

// Debug route
app.get("/", (req, res) => {
  res.send("API is running...");
});

exports.api = functions.https.onRequest(app);*/
const functions = require("firebase-functions");
const express = require("express");

console.log("STEP 1: Starting");

const app = express();
app.use(express.json());

console.log("STEP 2: Express ready");

try {
  console.log("STEP 3: Loading menu routes");
  const menuRoutes = require("./backend/routes/menu");

  console.log("STEP 4: Loading vendor routes");
  const vendorRoutes = require("./backend/routes/vendor");

  app.use("/menu", menuRoutes);
  app.use("/vendors", vendorRoutes);

  console.log("STEP 5: Routes loaded");

} catch (err) {
  console.error("❌ ERROR DURING LOAD:", err);
}

app.get("/", (req, res) => {
  res.send("API running");
});

exports.api = functions.https.onRequest(app);