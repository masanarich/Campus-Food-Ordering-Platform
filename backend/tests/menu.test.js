const { addItem } = require('../../backend/models/menuModel');

test("adds item to menu", () => {
  const item = {
    name: "Burger",
    description: "Delicious burger",
    price: 50,
    photo: "https://example.com/burger.jpg"
  };

  const result = addItem(item);

  expect(result).toMatchObject({
    name: "Burger",
    description: "Delicious burger",
    price: 50,
    photo: "https://example.com/burger.jpg",
    available: true
  });

  expect(result.id).toBeDefined();
});