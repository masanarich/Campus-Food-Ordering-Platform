const express = require('express');
const router = express.Router();

// ✅ CORRECT PATH
const {
  addItem,
  getItems,
  markSoldOut,
  updateItem
} = require('../models/menuModel');

// CREATE
router.post('/', (req, res) => {
  try {
    res.json(addItem(req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// READ
router.get('/', (req, res) => {
  res.json(getItems());
});

// SOLD OUT
router.put('/:id/soldout', (req, res) => {
  try {
    res.json(markSoldOut(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// UPDATE
router.put('/:id', (req, res) => {
  try {
    res.json(updateItem(req.params.id, req.body));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;