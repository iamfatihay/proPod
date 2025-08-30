// Mock for expo-font
const Font = {
    loadAsync: jest.fn().mockResolvedValue(undefined),
    isLoaded: jest.fn().mockReturnValue(true),
    getFontAsync: jest.fn().mockResolvedValue(undefined),
};

export default Font;
export { Font };
