const express = require('express');
const router = express.Router();
const { getVendors, approveVendor, suspendVendor } = require('../models/vendorModel');

router.get('/', (req, res) => {
  res.json(getVendors());
});

router.put('/:id/approve', (req, res) => {
  try{
    res.json(approveVendor(req.params.id));
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
  
});

router.put('/:id/suspend', (req, res) => {
  try{
    res.json(suspendVendor(req.params.id));
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

module.exports = router;