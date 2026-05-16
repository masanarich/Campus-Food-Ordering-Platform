 /**
 * seed.js
 *
 * Run ONCE to fill Firestore with 60 days of realistic demo data.
 * Place at your project root alongside firebase.js.
 *
 * Usage:
 *   node seed.js
 */

const { db, admin } = require('./firebase');

/* ── Demo vendors ─────────────────────────────────────────── */
const VENDORS = [
  { id: 'v1', name: 'The Matrix Grill' },
  { id: 'v2', name: 'Byte Bites' },
  { id: 'v3', name: 'Campus Curry House' },
  { id: 'v4', name: 'Wired Coffee & Wraps' },
];

/* ── Menu price options (in Rands) ───────────────────────── */
const PRICES = [35, 45, 55, 60, 75, 80, 95, 110, 120, 150];

/* ── Statuses (mostly completed) ─────────────────────────── */
const STATUSES = ['completed','completed','completed','completed','ready','cancelled'];

/* ── Hours that are busier than others ───────────────────── */
const PEAK_HOURS = [8, 9, 10, 12, 13, 14, 17, 18, 19];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPrice() {
  const numItems = randInt(1, 4);
  return [...PRICES].sort(() => 0.5 - Math.random()).slice(0, numItems).reduce((a,b) => a+b, 0);
}

(async () => {
  console.log('🌱 Starting Firestore seed...\n');

  /* ── Step 1: Write vendors ─────────────────────────────── */
  const vendorBatch = db.batch();
  VENDORS.forEach(v => {
    vendorBatch.set(db.collection('vendors').doc(v.id), {
      name:   v.name,
      active: true,
    });
  });
  await vendorBatch.commit();
  console.log(`✓ ${VENDORS.length} vendors written`);

  /* ── Step 2: Write orders (60 days) ────────────────────── */
  const DAY_MS     = 86_400_000;
  const now        = Date.now();
  let   totalOrders = 0;
  let   batch       = db.batch();
  let   batchSize   = 0;

  for (let daysAgo = 60; daysAgo >= 0; daysAgo--) {
    const baseDate  = new Date(now - daysAgo * DAY_MS);
    const dayOfWeek = baseDate.getDay(); // 0=Sun, 6=Sat

    // Weekdays get more orders than weekends
    const ordersToday = (dayOfWeek === 0 || dayOfWeek === 6)
      ? randInt(8, 25)
      : randInt(25, 70);

    for (let i = 0; i < ordersToday; i++) {
      // 70% chance of a peak hour, 30% random hour
      const hour   = Math.random() < 0.7
        ? PEAK_HOURS[Math.floor(Math.random() * PEAK_HOURS.length)]
        : randInt(7, 21);
      const minute = randInt(0, 59);

      const orderDate = new Date(baseDate);
      orderDate.setHours(hour, minute, 0, 0);

      const vendor = VENDORS[Math.floor(Math.random() * VENDORS.length)];
      const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];

      batch.set(db.collection('orders').doc(), {
        vendorId:   vendor.id,
        vendorName: vendor.name,
        amount:     randomPrice(),
        status,
        createdAt:  admin.firestore.Timestamp.fromDate(orderDate),
      });

      batchSize++;
      totalOrders++;

      // Firestore batch limit is 500 — commit and start a new one
      if (batchSize === 499) {
        await batch.commit();
        batch     = db.batch();
        batchSize = 0;
        process.stdout.write('.');
      }
    }
  }

  // Commit any remaining writes
  if (batchSize > 0) await batch.commit();

  console.log(`\n✓ ${totalOrders} orders seeded across 60 days`);
  console.log('\n🎉 Seed complete! Your analytics dashboard now has data.\n');
  process.exit(0);

})().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});