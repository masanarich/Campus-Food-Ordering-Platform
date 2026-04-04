const express = require('express');
const router = express.Router();
const { getVendors, approveVendor, suspendVendor } = require('../models/vendorModel');

router.get('/', (req, res) => {
  res.json(getVendors());
});

router.put('/:id/approve', (req, res) => {
  res.json(approveVendor(req.params.id));
});

router.put('/:id/suspend', (req, res) => {
  res.json(suspendVendor(req.params.id));
});

module.exports = router;