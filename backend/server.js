const express = require("express");
const app = express();
const cors = require("cors");

app.use(cors());
app.use(express.json());



let menu = [
  { id: "1", name: "Burger", price: 50, available: true },
  { id: "2", name: "Pizza", price: 80, available: true }
];

let vendors = [
  { id: "1", name: "Vendor A", status: "pending" },
  { id: "2", name: "Vendor B", status: "pending" }
];



// GET MENU
app.get("/menu", (req, res) => {
  res.json(menu);
});

// ADD ITEM
app.post("/menu", (req, res) => {
  const { name, price } = req.body;

  const newItem = {
    id: Date.now().toString(),
    name,
    price: Number(price),
    available: true
  };

  menu.push(newItem);
  res.json(newItem);
});

// MARK SOLD OUT
app.put("/menu/:id/soldout", (req, res) => {
  const item = menu.find(m => m.id === req.params.id);

  if (!item) return res.status(404).send("Item not found");

  item.available = false;
  res.json(item);
});

// UPDATE ITEM
app.put("/menu/:id", (req, res) => {
  const item = menu.find(m => m.id === req.params.id);

  if (!item) return res.status(404).send("Item not found");

  const { name, price } = req.body;

  item.name = name;
  item.price = Number(price);

  res.json(item);
});



// GET VENDORS
app.get("/vendors", (req, res) => {
  res.json(vendors);
});

// APPROVE VENDOR
app.put("/vendors/:id/approve", (req, res) => {
  const vendor = vendors.find(v => v.id === req.params.id);

  if (!vendor) return res.status(404).send("Vendor not found");

  vendor.status = "approved";
  res.json(vendor);
});

app.post("/menu", (req, res) => {
  const { name, price, photo } = req.body;

  const newItem = {
    id: Date.now().toString(),
    name,
    price: Number(price),
    photo: photo || "",
    available: true
  };

  menu.push(newItem);
  res.json(newItem);
});

// SUSPEND VENDOR
app.put("/vendors/:id/suspend", (req, res) => {
  const vendor = vendors.find(v => v.id === req.params.id);

  if (!vendor) return res.status(404).send("Vendor not found");

  vendor.status = "suspended";
  res.json(vendor);
});



const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🔥 Server running on http://localhost:${PORT}`);
});