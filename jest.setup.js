require("@testing-library/jest-dom");

// Prevent jsdom navigation errors by replacing window.location with a plain object
try {
	// override window.location with a plain object to avoid jsdom navigation errors
	Object.defineProperty(window, "location", {
		configurable: true,
		writable: true,
		value: { href: "", search: "", assign: () => {}, replace: () => {} }
	});
} catch (e) {
	// ignore if not allowed
}