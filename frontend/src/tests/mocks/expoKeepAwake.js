// Mock for expo-keep-awake
module.exports = {
    useKeepAwake: jest.fn(),
    activateKeepAwakeAsync: jest.fn().mockResolvedValue(undefined),
    deactivateKeepAwake: jest.fn().mockResolvedValue(undefined),
};
