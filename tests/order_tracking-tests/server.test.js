/**
 * @jest-environment node
 */

const request = require('supertest');

const { app, orders } = require('../../public/server');

describe('Order tracking server API', () => {
  beforeEach(() => {
    // clear in-memory orders between tests
    orders.clear();
  });

  test('GET /api/statuses returns statuses', async () => {
    const res = await request(app).get('/api/statuses');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.statuses)).toBe(true);
    expect(res.body.statuses.length).toBeGreaterThan(0);
  });

  test('POST /api/orders validation', async () => {
    const res = await request(app).post('/api/orders').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('POST /api/orders creates and GET endpoints return order', async () => {
    const payload = { studentName: 'Bob', itemName: 'Sandwich', vendorName: 'Canteen' };
    const post = await request(app).post('/api/orders').send(payload);
    expect(post.status).toBe(201);
    const created = post.body.order;
    expect(created).toMatchObject(payload);

    const list = await request(app).get('/api/orders');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.orders)).toBe(true);
    expect(list.body.orders.length).toBe(1);

    const detail = await request(app).get(`/api/orders/${created.orderId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.order.orderId).toBe(created.orderId);
  });

  test('PATCH /api/orders/:orderId/status transitions and validation', async () => {
    const payload = { studentName: 'Eve', itemName: 'Wrap', vendorName: 'Deli' };
    const post = await request(app).post('/api/orders').send(payload);
    const orderId = post.body.order.orderId;

    // invalid status
    const bad = await request(app).patch(`/api/orders/${orderId}/status`).send({ status: 'Unknown' });
    expect(bad.status).toBe(400);

    // valid forward transition
    const ok = await request(app).patch(`/api/orders/${orderId}/status`).send({ status: 'Preparing' });
    expect(ok.status).toBe(200);
    expect(ok.body.order.status).toBe('Preparing');

    // cannot move backwards
    const back = await request(app).patch(`/api/orders/${orderId}/status`).send({ status: 'Order Received' });
    expect(back.status).toBe(400);

    // non-existent order
    const notfound = await request(app).patch('/api/orders/doesnotexist/status').send({ status: 'Preparing' });
    expect(notfound.status).toBe(404);
  });
});
