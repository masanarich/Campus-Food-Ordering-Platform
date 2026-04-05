const express = require('express');
const router = express.Router();
const { addItem, getItems, markSoldOut ,updateItem} = require('../models/menuModel');

router.post('/', (req, res) => {
  res.json(addItem(req.body));
});

router.get('/', (req, res) => {
  res.json(getItems());
});

router.put('/:id/soldout', (req, res) => {
  res.json(markSoldOut(req.params.id));
});

router.put('/:id',(req,res)=>{
  try{
    const updated=updateItem(req.params.id,req.body);
    res.json(updated);
  }catch(err){
    res.status(404).send(err.message);
  }
});
module.exports = router;