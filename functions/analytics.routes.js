"use strict";

const { resolveAdminFirestore, sanitizeForCallable } = require("./index.js");

function getDb() {
  const db = resolveAdminFirestore();
  if (!db) throw new Error("Firestore is not available.");
  return db;
}

function toDate(str) {
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

async function getAnalyticsSales(data = {}) {
  const db = getDb();

  const from = toDate(data.from) || (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
  const to   = toDate(data.to)   || new Date();
  const vendorFilter = typeof data.vendor === "string" && data.vendor !== "all"
    ? data.vendor : null;

  let query = db.collection("orders")
    .where("createdAt", ">=", from)
    .where("createdAt", "<=", to)
    .where("status", "==", "completed");

  if (vendorFilter) {
    query = query.where("vendorId", "==", vendorFilter);
  }

  const snap = await query.get();

  // Group by vendor + day
  const byVendorDay = {};
  const vendorNames = {};

  snap.forEach(doc => {
    const order = doc.data();
    const vendor = order.vendorId   || "Unknown";
    const name   = order.vendorName || vendor;
    const day    = order.createdAt.toDate
      ? order.createdAt.toDate().toISOString().slice(0, 10)
      : new Date(order.createdAt).toISOString().slice(0, 10);

    vendorNames[vendor] = name;
    if (!byVendorDay[vendor]) byVendorDay[vendor] = {};
    byVendorDay[vendor][day] = (byVendorDay[vendor][day] || 0) + (order.total || 0);
  });

  // Summary totals per vendor
  const vendorTotals = Object.entries(byVendorDay).map(([vendorId, days]) => {
    const revenue = Object.values(days).reduce((a, b) => a + b, 0);
    return { vendorId, vendorName: vendorNames[vendorId], revenue, days };
  });

  const grandTotal   = vendorTotals.reduce((a, v) => a + v.revenue, 0);
  const totalOrders  = snap.size;
  const avgOrder     = totalOrders > 0 ? grandTotal / totalOrders : 0;
  const topVendor    = vendorTotals.sort((a, b) => b.revenue - a.revenue)[0] || null;

  return {
    success: true,
    summary: {
      grandTotal,
      totalOrders,
      avgOrder: Math.round(avgOrder * 100) / 100,
      topVendor: topVendor ? topVendor.vendorName : "—",
    },
    vendors: vendorTotals,
  };
}

async function getAnalyticsPeak(data = {}) {
  const db = getDb();

  const from = toDate(data.from) || (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
  const to   = toDate(data.to)   || new Date();

  const snap = await db.collection("orders")
    .where("createdAt", ">=", from)
    .where("createdAt", "<=", to)
    .get();

  const byHour    = Array(24).fill(0);
  const byWeekday = Array(7).fill(0);   // 0 = Sunday … 6 = Saturday
  // heatmap[weekday][hour]
  const heatmap   = Array.from({ length: 7 }, () => Array(24).fill(0));

  snap.forEach(doc => {
    const order = doc.data();
    const date  = order.createdAt && order.createdAt.toDate
      ? order.createdAt.toDate()
      : new Date(order.createdAt);

    const hour    = date.getHours();
    const weekday = date.getDay();

    byHour[hour]++;
    byWeekday[weekday]++;
    heatmap[weekday][hour]++;
  });

  return {
    success: true,
    byHour,
    byWeekday,
    heatmap,
  };
}


async function getAnalyticsCustom(data = {}) {
  const db = getDb();

  const from    = toDate(data.from) || (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
  const to      = toDate(data.to)   || new Date();
  const metric  = data.metric  || "revenue";   // revenue | orders | avg_order
  const groupBy = data.groupBy || "vendor";    // vendor  | hour   | day

  const snap = await db.collection("orders")
    .where("createdAt", ">=", from)
    .where("createdAt", "<=", to)
    .where("status", "==", "completed")
    .get();

  const groups   = {};
  const counts   = {};

  snap.forEach(doc => {
    const order = doc.data();
    const date  = order.createdAt && order.createdAt.toDate
      ? order.createdAt.toDate()
      : new Date(order.createdAt);

    let key;
    if (groupBy === "vendor")  key = order.vendorName || order.vendorId || "Unknown";
    if (groupBy === "hour")    key = date.getHours().toString();
    if (groupBy === "day")     key = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()];

    groups[key]  = (groups[key]  || 0) + (order.total || 0);
    counts[key]  = (counts[key]  || 0) + 1;
  });

  const rows = Object.keys(groups).map(label => {
    const revenue = groups[label];
    const orders  = counts[label];
    const avg     = orders > 0 ? revenue / orders : 0;
    return {
      label,
      value: metric === "revenue"   ? revenue
           : metric === "orders"    ? orders
           : Math.round(avg * 100) / 100,
    };
  });

  const total   = rows.reduce((a, r) => a + r.value, 0);
  const average = rows.length > 0 ? total / rows.length : 0;

  return {
    success: true,
    metric,
    groupBy,
    rows: rows.map(r => ({
      ...r,
      pct: total > 0 ? Math.round((r.value / total) * 1000) / 10 : 0,
      vsAvg: Math.round((r.value - average) * 100) / 100,
    })),
    total,
    average: Math.round(average * 100) / 100,
  };
}

module.exports = {
  getAnalyticsSales,
  getAnalyticsPeak,
  getAnalyticsCustom,
};