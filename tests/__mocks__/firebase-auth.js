module.exports = {
  getAuth: jest.fn(() => ({})),
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({ setCustomParameters: jest.fn() })),
  OAuthProvider: jest.fn().mockImplementation(() => ({ setCustomParameters: jest.fn() })),
  browserLocalPersistence: {},
  setPersistence: jest.fn(() => Promise.resolve()),
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(() => Promise.resolve()),
};
