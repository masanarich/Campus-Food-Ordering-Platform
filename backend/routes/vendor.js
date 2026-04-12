const express = require('express');
const router = express.Router();

const {
  getVendors,
  approveVendor,
  suspendVendor
} = require('../models/vendorModel');

router.get('/', (req, res) => {
  try {
    const vendors = getVendors();
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/approve', (req, res) => {
  try {
    const updatedVendor = approveVendor(req.params.id);
    res.json(updatedVendor);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.put('/:id/suspend', (req, res) => {
  try {
    const updatedVendor = suspendVendor(req.params.id);
    res.json(updatedVendor);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;