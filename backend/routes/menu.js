const express = require('express');
const router = express.Router();

const {
  addItem,
  getItems,
  markSoldOut,
  updateItem
} = require('../models/menuModel');

router.post('/', (req, res) => {
  try {
    if (!req.body.name || !req.body.price) {
      return res.status(400).json({ error: "Missing fields" });
    }
    res.json(addItem(req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  res.json(getItems());
});

router.put('/:id/soldout', (req, res) => {
  try {
    res.json(markSoldOut(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    if (req.body.price && req.body.price < 0) {
      return res.status(400).json({ error: "Invalid price" });
    }
    res.json(updateItem(req.params.id, req.body));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;