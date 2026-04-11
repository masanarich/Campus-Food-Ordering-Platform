let menu = [
  {
    id: "1",
    name: "Sample Burger",
    price: 50,
    description: "Default item",
    available: true
  }
];

// --------------------
// ADD ITEM
// --------------------
function addItem(item) {
  if (!item.name || !item.price) {
    throw new Error("Invalid item");
  }

  const newItem = {
    id: Date.now().toString(),
    name: item.name,
    description: item.description || "",
    price: item.price,
    photo: item.photo || "",
    available: true
  };

  menu.push(newItem);
  return newItem;
}

// --------------------
// GET ITEMS
// --------------------
function getItems() {
  return menu;
}

// --------------------
// MARK SOLD OUT
// --------------------
function markSoldOut(id) {
  const item = menu.find(i => i.id === id);

  if (!item) {
    throw new Error("Item not found");
  }

  item.available = false;
  return item;
}

// --------------------
// UPDATE ITEM
// --------------------
function updateItem(id, data) {
  const item = menu.find(i => i.id === id);

  if (!item) {
    throw new Error("Item not found");
  }

  // only update allowed fields (prevents breaking structure)
  const allowedFields = ["name", "description", "price", "photo", "available"];

  allowedFields.forEach(field => {
    if (data[field] !== undefined) {
      item[field] = data[field];
    }
  });

  return item;
}

// --------------------
// RESET (FOR TESTING ONLY)
// --------------------
function __resetMenu() {
  menu = [
    {
      id: "1",
      name: "Sample Burger",
      price: 50,
      description: "Default item",
      available: true
    }
  ];
}

module.exports = {
  addItem,
  getItems,
  markSoldOut,
  updateItem,
  __resetMenu
};