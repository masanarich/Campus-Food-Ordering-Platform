/*const API = 'http://localhost:3000';

document.getElementById("menuForm").addEventListener("submit",async(e)=>{
    e.preventDefault();
    await fetch(`$(API)/menu`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
            name: name.value,
            description:description.value,
            price:price.value
        })
    });
    loadMenu();
});

async function loadMenu() {
    const res = await fetch(`${API}/menu`);
    const data = await res.json();
    const menuList=document.getElementById("menuList");
    menuList.innerHTML="";

    data.forEach(item =>{
        menuList.innerHTML+=`
        <div>
            <h3>${item.name}</h3>
            <p>${item.description}</p>
            <p>${item.price}</p>
            <button onclick="soldout(${item.id})">Sold Out</button>
        </div>
        `;
    });

    async function soldOut(id) {
        await fetch(`${API}/menu/${id}/soldout`,{method:"PUT"});
        loadMenu();
    }
    loadMenu();
    
}*/
function formatItem(item) {
  return `${item.name} - R${item.price}`;
}

module.exports = { formatItem };
