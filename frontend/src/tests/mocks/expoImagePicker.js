// Mock for expo-image-picker
module.exports = {
    requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    launchCameraAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
    MediaTypeOptions: { Images: 'Images', Videos: 'Videos', All: 'All' },
};
