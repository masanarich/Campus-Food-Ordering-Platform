module.exports = {
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
};