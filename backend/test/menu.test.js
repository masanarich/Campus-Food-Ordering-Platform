/**
 * @jest-environment jsdom
 */

document.body.innerHTML = `
  <ul id="menuList"></ul>
`;

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve([
      { id: "1", name: "Burger", price: 50, available: true }
    ])
  })
);

const { loadMenu } = require("../../public/admin/js/menu");

test("should render menu items", async () => {
  await loadMenu();

  const list = document.getElementById("menuList");
  expect(list.children.length).toBe(1);
});