const express = require("express");
const cors = require("cors");

const menuRoutes = require("./backend/routes/menu");
const vendorRoutes = require("./backend/routes/vendor");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/menu", menuRoutes);
app.use("/vendors", vendorRoutes);

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});