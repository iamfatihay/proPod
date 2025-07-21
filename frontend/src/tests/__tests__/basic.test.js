// Basic test to verify Jest setup
describe("Basic Test Setup", () => {
    test("Jest is working correctly", () => {
        expect(true).toBe(true);
    });

    test("Math operations work", () => {
        expect(2 + 2).toBe(4);
        expect(5 * 3).toBe(15);
    });

    test("Async operations work", async () => {
        const promise = Promise.resolve("test");
        await expect(promise).resolves.toBe("test");
    });

    test("Mock functions work", () => {
        const mockFn = jest.fn();
        mockFn("test");
        expect(mockFn).toHaveBeenCalledWith("test");
    });
});
