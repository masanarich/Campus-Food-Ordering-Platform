const vendor = require("../../public/vendor/index.js");

describe("Vendor Order Management (TDD)", () => {

  beforeEach(() => {
    vendor.setFirebase({
      collection: jest.fn(),
      query: jest.fn(),
      where: jest.fn(),
      getDocs: jest.fn(() => ({
        docs: [
          {
            id: "1",
            data: () => ({
              itemName: "Burger",
              vendorId: "vendor123",
              status: "pending"
            })
          }
        ]
      })),
      doc: jest.fn(),
      updateDoc: jest.fn(() => Promise.resolve()),
      onSnapshot: jest.fn(),
      db: {}
    });
  });

  // ✅ TEST 1
  it("should return orders for a vendor", async () => {
    const orders = await vendor.getVendorOrders("vendor123");

    expect(Array.isArray(orders)).toBe(true);
  });

  // ✅ TEST 2
  it("should return correct vendor orders only", async () => {
    const orders = await vendor.getVendorOrders("vendor123");

    orders.forEach(order => {
      expect(order.vendorId).toBe("vendor123");
    });
  });

  // ✅ TEST 3
  it("should return empty array if no orders", async () => {
    vendor.setFirebase({
      collection: jest.fn(),
      query: jest.fn(),
      where: jest.fn(),
      getDocs: jest.fn(() => ({ docs: [] })),
      doc: jest.fn(),
      updateDoc: jest.fn(),
      onSnapshot: jest.fn(),
      db: {}
    });

    const orders = await vendor.getVendorOrders("unknownVendor");

    expect(orders).toEqual([]);
  });

  // ✅ TEST 4
  it("should update order status to received", async () => {
    const result = await vendor.receiveOrder("order123");

    expect(result).toEqual({ success: true });
  });

  // ✅ TEST 5
  it("should handle update failure gracefully", async () => {
    vendor.setFirebase({
      collection: jest.fn(),
      query: jest.fn(),
      where: jest.fn(),
      getDocs: jest.fn(),
      doc: jest.fn(),
      updateDoc: jest.fn(() => Promise.reject(new Error("fail"))),
      onSnapshot: jest.fn(),
      db: {}
    });

    const result = await vendor.receiveOrder("order123");

    expect(result.success).toBe(false);
  });

});