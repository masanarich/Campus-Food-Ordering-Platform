const express = require("express");
const app = express();

app.use(express.json());

// ✅ CORRECT PATHS (same folder level)
app.use("/menu", require("./routes/menu"));
app.use("/vendors", require("./routes/vendor"));

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("API WORKING");
});

// LOCAL SERVER (for testing only)
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});