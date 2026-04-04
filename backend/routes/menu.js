const express = require('express');
const router = express.Router();
const { addItem, getItems, markSoldOut } = require('../models/menuModel');

router.post('/', (req, res) => {
  res.json(addItem(req.body));
});

router.get('/', (req, res) => {
  res.json(getItems());
});

router.put('/:id/soldout', (req, res) => {
  res.json(markSoldOut(req.params.id));
});

module.exports = router;