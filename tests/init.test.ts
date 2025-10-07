// Mocks for missing pointer capture methods in jsdom
Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
	value: () => false,
});
Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
	value: () => {},
});
