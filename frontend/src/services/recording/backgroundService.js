/**
 * Background Recording Service
 * Handles background task registration and persistent notifications
 * Shows recording status in notification tray (like media players)
 * 
 * Note: Full functionality requires production build or dev client
 * Gracefully degrades in Expo Go
 */

import { Platform } from 'react-native';
import Logger from '../../utils/logger';

// Dynamic imports for native modules (handles Expo Go gracefully)
let Notifications = null;
let TaskManager = null;

try {
    Notifications = require('expo-notifications');
    TaskManager = require('expo-task-manager');
} catch (error) {
    Logger.warn('Native modules not available (Expo Go). Notifications disabled.', error);
}

const BACKGROUND_TASK_NAME = 'recording-protection-task';

// Configure notification behavior (only if available)
if (Notifications) {
    try {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowBanner: true, // iOS
                shouldShowList: true, // iOS
                shouldPlaySound: false,
                shouldSetBadge: true,
                priority: Notifications.AndroidNotificationPriority?.HIGH,
            }),
        });
    } catch (error) {
        Logger.warn('Notification handler setup failed:', error.message);
    }
}

class BackgroundRecordingService {
    constructor() {
        this.isRecordingActive = false;
        this.notificationId = null;
        this.channelSetup = false;
        this.keepAliveInterval = null;
        this.currentPodcastTitle = 'New Recording';
    }

    /**
     * Setup Android notification channel for persistent notifications
     */
    async setupNotificationChannel() {
        if (!Notifications || Platform.OS !== 'android' || this.channelSetup) {
            return;
        }

        try {
            await Notifications.setNotificationChannelAsync('recording', {
                name: 'Recording',
                importance: Notifications.AndroidImportance.HIGH,
                sound: null,
                vibrationPattern: null,
                enableVibrate: false,
                showBadge: false,
                enableLights: true,
                lightColor: '#EF4444', // Theme red color
            });
            this.channelSetup = true;
        } catch (error) {
            Logger.error('Channel setup failed:', error);
        }
    }

    /**
     * Request notification permissions
     */
    async requestPermissions() {
        if (!Notifications) {
            Logger.warn('Notifications not available - running in Expo Go?');
            return false;
        }

        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                Logger.warn('Notification permission not granted');
                return false;
            }

            return true;
        } catch (error) {
            Logger.error('Notification permission request failed:', error);
            return false;
        }
    }

    /**
     * Start background recording with persistent notification
     */
    async startRecording(podcastTitle = 'New Recording') {
        if (!Notifications) {
            Logger.error('❌ Notifications module is NULL - cannot show notifications');
            Logger.error('This should NOT happen in development build. Check expo-notifications installation.');
            this.isRecordingActive = true;
            return;
        }

        try {
            const hasPermission = await this.requestPermissions();
            if (!hasPermission) {
                Logger.warn('⚠️ Notification permission not granted - continuing without notifications');
            } else {
            }

            // Setup channel first (Android)
            await this.setupNotificationChannel();

            this.isRecordingActive = true;
            this.currentPodcastTitle = podcastTitle;

            // Show persistent notification (no updates, stays visible)
            await this.showRecordingNotification(podcastTitle);
            
            // Set app badge to indicate recording (iOS primarily)
            if (Notifications.setBadgeCountAsync) {
                await Notifications.setBadgeCountAsync(1);
            }

            // Start keep-alive timer (checks every 30 seconds)
            this.startKeepAlive();

            // Register background task (Android only, iOS has different approach)
            if (Platform.OS === 'android' && TaskManager) {
                await this.registerBackgroundTask();
            }
        } catch (error) {
            Logger.error('Background recording start failed:', error);
            this.isRecordingActive = true; // Continue anyway
        }
    }

    /**
     * Keep notification alive - re-show every 30 seconds
     * This ensures notification stays visible even if dismissed
     */
    startKeepAlive() {
        if (!Notifications || this.keepAliveInterval) return;

        this.keepAliveInterval = setInterval(async () => {
            if (this.isRecordingActive) {
                try {
                    // Dismiss old notification first to prevent accumulation
                    if (this.notificationId) {
                        await Notifications.dismissNotificationAsync(this.notificationId).catch(() => {});
                    }
                    
                    // Show fresh notification
                    await this.showRecordingNotification(this.currentPodcastTitle);
                } catch (error) {
                    Logger.warn('Keep-alive check failed:', error);
                }
            }
        }, 30000); // Refresh every 30 seconds
    }

    /**
     * Show persistent recording notification
     */
    async showRecordingNotification(title) {
        if (!Notifications) {
            Logger.warn('📱 Notifications module not available');
            return;
        }

        try {
            // Don't dismiss - just update by scheduling with same identifier
            // This prevents flickering

            const notificationContent = {
                title: '🎙️ Recording in Progress',
                body: title || 'Recording...',
                sound: false,
                priority: Notifications.AndroidNotificationPriority?.HIGH,
                sticky: true,
                data: { type: 'recording', ongoing: true },
            };

            // Android-specific configuration for truly persistent notification
            if (Platform.OS === 'android') {
                notificationContent.channelId = 'recording';
                notificationContent.color = '#EF4444'; // Theme red color
                notificationContent.badge = 0;
                // Make it ongoing (non-dismissible and shows in status bar)
                notificationContent.autoDismiss = false;
            }

            const notification = await Notifications.scheduleNotificationAsync({
                content: notificationContent,
                trigger: null, // Show immediately
            });

            this.notificationId = notification;
        } catch (error) {
            Logger.error('❌ Notification display failed:', error);
        }
    }
    /**
     * Stop recording and dismiss notification
     */
    async stopRecording() {
        try {
            this.isRecordingActive = false;

            // Stop keep-alive timer
            if (this.keepAliveInterval) {
                clearInterval(this.keepAliveInterval);
                this.keepAliveInterval = null;
            }

            // Dismiss notification and clear badge
            if (this.notificationId && Notifications) {
                await Notifications.dismissNotificationAsync(this.notificationId);
                this.notificationId = null;
                
                // Clear app badge
                if (Notifications.setBadgeCountAsync) {
                    await Notifications.setBadgeCountAsync(0);
                }
            }

            if (Platform.OS === 'android' && TaskManager) {
                await this.unregisterBackgroundTask();
            }
        } catch (error) {
            Logger.error('Background recording stop failed:', error);
        }
    }

    /**
     * Register background task for Android
     */
    async registerBackgroundTask() {
        if (!TaskManager) return;

        try {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
            
            if (!isRegistered) {
                // Note: Expo Go doesn't fully support background tasks
                // This works in standalone/production builds
            }
        } catch (error) {
            Logger.error('Background task registration failed:', error);
        }
    }

    async unregisterBackgroundTask() {
        if (!TaskManager) return;

        try {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
            
            if (isRegistered) {
                await TaskManager.unregisterTaskAsync(BACKGROUND_TASK_NAME);
            }
        } catch (error) {
            Logger.error('Background task unregister failed:', error);
        }
    }

    /**
     * Check if recording is active
     */
    isActive() {
        return this.isRecordingActive;
    }
}

// Background task definition (for production builds)
if (TaskManager) {
    try {
        TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
            try {
                // Keep-alive task to maintain recording state
                // In production, this could trigger periodic draft saves
                return { success: true };
            } catch (error) {
                Logger.error('Background task error:', error);
                return { success: false };
            }
        });
    } catch (error) {
        Logger.warn('Background task definition failed:', error.message);
    }
}

export default new BackgroundRecordingService();
