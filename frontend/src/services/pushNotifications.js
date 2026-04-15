/**
 * pushNotifications.js
 *
 * Registers the device for Expo push notifications and syncs the token with the
 * proPod backend so that server-side events (likes, comments, DMs) can trigger
 * out-of-app alerts.
 *
 * Usage: call `registerPushToken()` once after the user has authenticated.
 * The function is idempotent — safe to call on every cold start.
 *
 * Note: Notifications.setNotificationHandler (the global singleton) is NOT set
 * here.  It is set once in frontend/app/_layout.js to avoid import-order
 * conflicts with the background recording notification handler.
 */

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import apiService from './api/apiService';
import Logger from '../utils/logger';

/**
 * Request push permission and register the Expo push token with the backend.
 *
 * Silently no-ops on simulators/emulators (no token available) and when the
 * user denies permission.  All errors are caught so a push failure never
 * breaks the app startup flow.
 *
 * @returns {Promise<string|null>} The registered token string, or null on failure.
 */
export async function registerPushToken() {
    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();

        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            Logger.info('Push permission not granted — skipping token registration');
            return null;
        }

        // projectId is required on Expo SDK 53+ for dev-client and standalone builds.
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
        );
        const token = tokenData?.data;

        if (!token) {
            Logger.info('No Expo push token available (simulator or env issue)');
            return null;
        }

        const platform =
            Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown';

        // Sync to backend (idempotent — safe to call every launch)
        await apiService.registerDeviceToken(token, platform);

        // Only log a non-sensitive confirmation in dev; never log the token itself.
        if (__DEV__) {
            Logger.info('Push token registered successfully');
        }

        return token;
    } catch (err) {
        // Never crash the app over push registration
        Logger.warn('Push token registration failed:', err?.message ?? err);
        return null;
    }
}

/**
 * Unregister the current device's push token from the backend.
 * Call this on explicit logout so the user stops receiving push alerts.
 *
 * @returns {Promise<void>}
 */
export async function unregisterPushToken() {
    try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
        ).catch(() => null);
        const token = tokenData?.data;
        if (token) {
            await apiService.removeDeviceToken(token);
            if (__DEV__) {
                Logger.info('Push token unregistered');
            }
        }
    } catch (err) {
        Logger.warn('Push token unregister failed:', err?.message ?? err);
    }
}
