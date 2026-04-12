const express = require("express");
const router = express.Router();

const {
  addMenuItem,
  getMenu,
  markItemSoldOut,
  updateMenuItem
} = require("../models/menuModel");

// GET
router.get("/", (req, res) => {
  res.json(getMenu());
});

// POST
router.post("/", (req, res) => {
  try {
    const { name, description, price, photo } = req.body;
    const item = addMenuItem(name, description, price, photo);
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// SOLD OUT
router.put("/:id/soldout", (req, res) => {
  try {
    res.json(markItemSoldOut(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// UPDATE
router.put("/:id", (req, res) => {
  try {
    const { name, description, price } = req.body;
    res.json(updateMenuItem(req.params.id, name, description, price));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;