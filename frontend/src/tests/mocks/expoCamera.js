const CameraView = jest.fn().mockReturnValue(null);

const useCameraPermissions = jest.fn().mockReturnValue([
    { granted: true, status: "granted" },
    jest.fn().mockResolvedValue({ granted: true, status: "granted" }),
]);

const useMicrophonePermissions = jest.fn().mockReturnValue([
    { granted: true, status: "granted" },
    jest.fn().mockResolvedValue({ granted: true, status: "granted" }),
]);

module.exports = {
    CameraView,
    useCameraPermissions,
    useMicrophonePermissions,
};
