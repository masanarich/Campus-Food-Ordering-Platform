const express = require('express');
const router = express.Router();

const {
  getVendors,
  approveVendor,
  suspendVendor
} = require('../models/vendorModel');

// GET ALL
router.get('/', (req, res) => {
  res.json(getVendors());
});

// APPROVE
router.put('/:id/approve', (req, res) => {
  try {
    res.json(approveVendor(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// SUSPEND
router.put('/:id/suspend', (req, res) => {
  try {
    res.json(suspendVendor(req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;