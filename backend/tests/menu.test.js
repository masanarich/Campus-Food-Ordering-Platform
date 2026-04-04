const { formatItem } = require('../frontend/js/vendor');

test("formats item", () => {
  const result = formatItem({ name: "Burger", price: 50 });
  expect(result).toBe("Burger - R50");
});