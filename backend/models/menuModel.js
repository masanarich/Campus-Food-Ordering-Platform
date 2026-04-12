let menu = [];

// CREATE
function addMenuItem(name, description, price, photo) {
  if (!name || !price) throw new Error("Invalid item");

  const item = {
    id: Date.now().toString(),
    name,
    description: description || "",
    price: Number(price),
    photo: photo || "",
    available: true
  };

  menu.push(item);
  return item;
}

// READ
function getMenu() {
  return menu;
}

// SOLD OUT
function markItemSoldOut(id) {
  const item = menu.find(i => i.id === id);
  if (!item) throw new Error("Item not found");

  item.available = false;
  return item;
}

// UPDATE
function updateMenuItem(id, name, description, price) {
  const item = menu.find(i => i.id === id);
  if (!item) throw new Error("Item not found");

  if (name) item.name = name;
  if (description) item.description = description;
  if (price) item.price = Number(price);

  return item;
}

// RESET (TEST)
function __resetMenu() {
  menu = [];
}

module.exports = {
  addMenuItem,
  getMenu,
  markItemSoldOut,
  updateMenuItem,
  __resetMenu
};