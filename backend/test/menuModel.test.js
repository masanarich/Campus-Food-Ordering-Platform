const {
  addMenuItem,
  getMenu,
  __resetMenu
} = require("../../backend/models/menuModel");

beforeEach(() => __resetMenu());

test("adds item with description", () => {
  addMenuItem("Burger", "Nice food", 50);
  expect(getMenu()[0].description).toBe("Nice food");
});