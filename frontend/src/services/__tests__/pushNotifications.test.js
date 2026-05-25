let mockPlatformOS = 'android';
let mockExpoConfig = {
    extra: {
        eas: {
            projectId: 'test-project-id',
        },
    },
};

jest.mock('expo-notifications', () => ({
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
}));

jest.mock('expo-constants', () => ({
    __esModule: true,
    default: {
        get expoConfig() {
            return mockExpoConfig;
        },
    },
}));

jest.mock('react-native', () => {
    const actual = jest.requireActual('react-native');
    return {
        ...actual,
        Platform: {
            ...actual.Platform,
            get OS() {
                return mockPlatformOS;
            },
        },
    };
});

jest.mock('../api/apiService', () => ({
    registerDeviceToken: jest.fn().mockResolvedValue(undefined),
    removeDeviceToken: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
}));

let apiService;
let Logger;
let Notifications;
let pushNotifications;

describe('pushNotifications', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockPlatformOS = 'android';
        mockExpoConfig = {
            extra: {
                eas: {
                    projectId: 'test-project-id',
                },
            },
        };

        const apiServiceModule = require('../api/apiService');
        apiService = apiServiceModule.default || apiServiceModule;

        const loggerModule = require('../../utils/logger');
        Logger = loggerModule.default || loggerModule;

        Notifications = require('expo-notifications');

        pushNotifications = require('../pushNotifications');
    });

    test('reports missing Android Firebase config when no google-services file is configured', () => {
        expect(pushNotifications.hasAndroidFirebaseConfig()).toBe(false);
    });

    test('skips Android push token registration when Firebase config is missing', async () => {
        const token = await pushNotifications.registerPushToken();

        expect(token).toBeNull();
        expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
        expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
        expect(apiService.registerDeviceToken).not.toHaveBeenCalled();
        expect(Logger.info).toHaveBeenCalledWith(
            'Android push token registration skipped for this app session: missing Firebase/FCM config (googleServicesFile).'
        );
    });

    test('logs missing Android Firebase config only once per app session', async () => {
        await pushNotifications.registerPushToken();
        await pushNotifications.registerPushToken();

        expect(Logger.info).toHaveBeenCalledTimes(1);
        expect(Logger.info).toHaveBeenCalledWith(
            'Android push token registration skipped for this app session: missing Firebase/FCM config (googleServicesFile).'
        );
    });

    test('skips Android push token unregister when Firebase config is missing', async () => {
        await pushNotifications.unregisterPushToken();

        expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
        expect(apiService.removeDeviceToken).not.toHaveBeenCalled();
    });

    test('registers Android push token when Firebase config is present', async () => {
        mockExpoConfig = {
            ...mockExpoConfig,
            android: {
                googleServicesFile: './google-services.json',
            },
        };

        const token = await pushNotifications.registerPushToken();

        expect(token).toBe('ExponentPushToken[test]');
        expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
        expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
            projectId: 'test-project-id',
        });
        expect(apiService.registerDeviceToken).toHaveBeenCalledWith(
            'ExponentPushToken[test]',
            'android'
        );
    });
});