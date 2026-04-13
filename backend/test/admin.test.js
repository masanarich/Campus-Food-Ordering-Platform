/**
 * @jest-environment jsdom
 */

document.body.innerHTML = `
  <ul id="vendorList"></ul>
`;

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve([
      { id: "1", name: "Vendor A", status: "pending" }
    ])
  })
);

const { loadVendors } = require("../../public/admin/js/admin");

test("should load vendors into DOM", async () => {
  await loadVendors();

  const list = document.getElementById("vendorList");
  expect(list.children.length).toBe(1);
});