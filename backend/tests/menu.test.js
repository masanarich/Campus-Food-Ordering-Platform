const {
  addItem,
  markSoldOut,
  __resetMenu
} = require('../models/menuModel');

beforeEach(() => {
  __resetMenu();
});

test("adds item", () => {
  const item = addItem({
    name: "Burger",
    price: 50,
    photo: "url.jpg"
  });

  expect(item.id).toBeDefined();
  expect(item.available).toBe(true);
});

test("marks sold out", () => {
  const item = addItem({ name: "Pizza", price: 80 });

  const result = markSoldOut(item.id);

  expect(result.available).toBe(false);
});