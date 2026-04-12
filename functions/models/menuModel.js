let menu = [];

/**
 * CREATE ITEM
 */
function addMenuItem(name, price, photo) {
  if (!name || !price) {
    throw new Error("Invalid item");
  }

  const newItem = {
    id: Date.now().toString(),
    name,
    price: Number(price),
    photo: photo || "",
    available: true
  };

  menu.push(newItem);
  return newItem;
}


/**
 * READ ALL
 */
function getMenu() {
  return menu;
}


/**
 * MARK SOLD OUT
 */
function markItemSoldOut(id) {
  const item = menu.find(i => i.id === id);
  if (!item) throw new Error("Item not found");

  item.available = false;
  return item;
}


/**
 * UPDATE ITEM
 */
function updateMenuItem(id, name, price) {
  const item = menu.find(i => i.id === id);
  if (!item) throw new Error("Item not found");

  if (name) item.name = name;
  if (price) item.price = Number(price);

  return item;
}


/**
 * RESET (TEST ONLY)
 */
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