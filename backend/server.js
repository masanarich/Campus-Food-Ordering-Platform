const express = require('express');
const app=express();

app.use(express.json());

let menu=[];
let vendors=[{id: 1, name: "Vendor 1", status: "pending"}];

//Add item
app.post('/menu', (req,res)=>{
    const item={id: Date.now(),...req.body, is_available:true};
    menu.push(item);
    res.json(item);
});

//Get menu
app.get('/menu',(req,res)=>{
    res.json(menu);
});

//Mark sold out
app.put('/menu/:id/soldout',(req,res)=>{
    const item = menu.find(i=>i.id==req.params.id);
    if(item){
        item.is_available=false;
        res.json(item);
    }else{
        res.status(404).json({message:"item not found"});
    }
});

//Get vendors
app.get('/vendors',(req,res)=>{
    res.json(vendors);
});

//Approve vendor
app.put('/vendors/:id/approve',(req,res)=>{
    const v=vendors.find(v=>v.id==req.params.id);
    if(v){
        v.status="approved";
        res.json(v);
    }
});

//Suspend vendor
app.put('/vendors/:id/suspend',(req,res)=>{
    const v=vendors.find(v=>v.id==req.params.id);
    if(v){
        v.status="suspended";
        res.json(v);
    }
});

app.listen(3000,()=>console.log("Server running on port 3000"));