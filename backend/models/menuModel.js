let menu = [];

/**
 * CREATE ITEM
 */
function addItem(item) {
  if (!item.name || !item.price) {
    throw new Error("Invalid item");
  }

  const newItem = {
    id: Date.now().toString(),
    name: item.name,
    description: item.description || "",
    price: Number(item.price),
    photo: item.photo || null,
    available: true
  };

  menu.push(newItem);
  return newItem;
}

/**
 * READ ALL
 */
function getItems() {
  return menu;
}

/**
 * MARK SOLD OUT
 */
function markSoldOut(id) {
  const item = menu.find(i => i.id === id);
  if (!item) throw new Error("Item not found");

  item.available = false;
  return item;
}

/**
 * UPDATE ITEM
 */
function updateItem(id, data) {
  const item = menu.find(i => i.id === id);
  if (!item) throw new Error("Item not found");

  Object.assign(item, data);
  return item;
}

/**
 * RESET (TEST ONLY)
 */
function __resetMenu() {
  menu = [];
}

module.exports = {
  addItem,
  getItems,
  markSoldOut,
  updateItem,
  __resetMenu
};