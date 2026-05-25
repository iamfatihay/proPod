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

import * as Notifications from 'expo-notifications';
import apiService from '../api/apiService';
import Logger from '../../utils/logger';
import {
    hasAndroidFirebaseConfig,
    registerPushToken,
    unregisterPushToken,
} from '../pushNotifications';

describe('pushNotifications', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPlatformOS = 'android';
        mockExpoConfig = {
            extra: {
                eas: {
                    projectId: 'test-project-id',
                },
            },
        };
    });

    test('reports missing Android Firebase config when no google-services file is configured', () => {
        expect(hasAndroidFirebaseConfig()).toBe(false);
    });

    test('skips Android push token registration when Firebase config is missing', async () => {
        const token = await registerPushToken();

        expect(token).toBeNull();
        expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
        expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
        expect(apiService.registerDeviceToken).not.toHaveBeenCalled();
        expect(Logger.info).toHaveBeenCalledWith(
            'Android push token registration skipped: Firebase config is missing'
        );
    });

    test('skips Android push token unregister when Firebase config is missing', async () => {
        await unregisterPushToken();

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

        const token = await registerPushToken();

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