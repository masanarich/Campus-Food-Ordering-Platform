const db = {};
const auth = {};
const storage = {};
const functions = {};
const analytics = null;
const googleProvider = { setCustomParameters: jest.fn() };
const appleProvider = { setCustomParameters: jest.fn() };

module.exports = {
  db,
  auth,
  storage,
  functions,
  analytics,
  googleProvider,
  appleProvider,
  initAnalytics: jest.fn(() => Promise.resolve(null)),
};