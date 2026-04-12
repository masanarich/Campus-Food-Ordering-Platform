console.log("🔥 START");

try {
  console.log("STEP 1: require express");
  const express = require("express");

  console.log("STEP 2: create app");
  const app = express();

  console.log("STEP 3: require menu");
  require("./backend/routes/menu");
  console.log("STEP 4: menu OK");

  console.log("STEP 5: require vendor");
  require("./backend/routes/vendor");
  console.log("STEP 6: vendor OK");

  console.log("STEP 7: DONE");

} catch (e) {
  console.error("🔥 CRASH:", e);
}

process.exit(0);