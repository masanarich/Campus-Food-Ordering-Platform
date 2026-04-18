const mockUnsubscribe = jest.fn();
const mockOnSnapshot = jest.fn(() => mockUnsubscribe);
const mockUpdateDoc = jest.fn(() => Promise.resolve());
const mockDoc = jest.fn((db, collection, id) => ({ db, collection, id }));
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockOrderBy = jest.fn();
const mockServerTimestamp = jest.fn(() => ({ _type: "serverTimestamp" }));

module.exports = {
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  updateDoc: mockUpdateDoc,
  collection: mockCollection,
  query: mockQuery,
  orderBy: mockOrderBy,
  serverTimestamp: mockServerTimestamp,
  getFirestore: jest.fn(() => ({})),
};