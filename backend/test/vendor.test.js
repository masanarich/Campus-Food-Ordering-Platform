/**
 * @jest-environment jsdom
 */

document.body.innerHTML = `<ul id="menuList"></ul>`;

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve([
      { id: "1", name: "Burger", description: "Nice", price: 50, available: true }
    ])
  })
);

const { loadMenu } = require("../../frontend/js/vendor");

test("should render menu items", async () => {
  await loadMenu();
  expect(document.getElementById("menuList").children.length).toBe(1);
});