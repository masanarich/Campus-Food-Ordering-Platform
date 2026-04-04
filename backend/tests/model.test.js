const { addItem, getItems, markSoldOut } = require('../backend/models/menuModel');

test("adds item", () => {
  const item = addItem({ name: "Burger", price: 50 });
  expect(item.name).toBe("Burger");
});

test("fails invalid item", () => {
  expect(() => addItem({})).toThrow();
});

test("marks item sold out", () => {
  const item = addItem({ name: "Pizza", price: 80 });
  const result = markSoldOut(item.id);
  expect(result.available).toBe(false);
});