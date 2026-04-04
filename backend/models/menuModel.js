let menu = [];

function addItem(item) {
  if (!item.name || !item.price) {
    throw new Error("Invalid item");
  }
  const newItem = { id: Date.now(), ...item, available: true };
  menu.push(newItem);
  return newItem;
}

function getItems() {
  return menu;
}

function markSoldOut(id) {
  const item = menu.find(i => i.id == id);
  if (!item) throw new Error("Item not found");
  item.available = false;
  return item;
}

module.exports = { addItem, getItems, markSoldOut };