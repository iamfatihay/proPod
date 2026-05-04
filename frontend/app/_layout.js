import { Stack, useRouter, useSegments } from "expo-router";
import useAuthStore from "../src/context/useAuthStore";
import { useEffect, useRef, useCallback, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import { ToastProvider } from "../src/components/Toast";
import { View, ActivityIndicator, AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import apiService from "../src/services/api/apiService";
import protectionService from "../src/services/recording/protectionService";
import DraftRecoveryModal from "../src/components/DraftRecoveryModal";
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import Logger from "../src/utils/logger";
import { registerPushToken } from "../src/services/pushNotifications";
import useAudioStore from "../src/context/useAudioStore";
import useDMStore from "../src/context/useDMStore";
import hapticFeedback from "../src/services/haptics/hapticFeedback";

// Set once at the root level — controls how push notifications appear while the
// app is in the foreground.  Centralised here to avoid import-order conflicts
// with the background recording notification handler.
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export default function Layout() {
    const { user, isInitializing } = useAuthStore();
    const router = useRouter();
    const segments = useSegments();
    const initAuth = useAuthStore((state) => state.initAuth);
    const logout = useAuthStore((state) => state.logout);

    const [draft, setDraft] = useState(null);
    const [showDraftModal, setShowDraftModal] = useState(false);

    // Ref to hold a deep link URL that arrived before auth was ready (cold start)
    const pendingDeepLinkRef = useRef(null);
    const deepLinkNavigationInProgressRef = useRef(false);
    // Ref for the DM unread-badge poll interval so we can clear it on unmount
    // or when the app moves to the background.
    const dmPollRef = useRef(null);

    /**
     * Parse a deep link URL and navigate to the appropriate screen.
     *
     * Supported patterns:
     *   volo://podcast/{id}   →  /(main)/details?id={id}
     *   volo://playlist/{id}  →  /(main)/playlist-detail?id={id}
    *   volo://live/{code}    →  /live?inviteCode={code}
     */
    const handleDeepLink = useCallback((url) => {
        if (!url) return;
        try {
            const parsed = Linking.parse(url);
            const id = parsed.path ? parsed.path.replace(/^\//, '') : null;

            if (parsed.hostname === 'podcast' && id) {
                deepLinkNavigationInProgressRef.current = true;
                Logger.info('Deep link: navigating to podcast', id);
                router.push({ pathname: '/(main)/details', params: { id } });
                return true;
            }

            if (parsed.hostname === 'playlist' && id) {
                deepLinkNavigationInProgressRef.current = true;
                Logger.info('Deep link: navigating to playlist', id);
                router.push({ pathname: '/(main)/playlist-detail', params: { id } });
                return true;
            }

            if (parsed.hostname === 'live' && id) {
                deepLinkNavigationInProgressRef.current = true;
                Logger.info('Deep link: navigating to live invite', id);
                router.push({ pathname: '/live', params: { inviteCode: id } });
                return true;
            }
        } catch (err) {
            Logger.error('Deep link parse error:', err);
        }
        return false;
    }, [router]);

    // Register deep link handlers on mount (runs once)
    useEffect(() => {
        // Cold start: app was launched via deep link
        Linking.getInitialURL().then((url) => {
            if (!url) return;

            const state = useAuthStore.getState();
            if (!state.isInitializing && state.user) {
                handleDeepLink(url);
                return;
            }

            // Store; we'll flush it once auth resolves (see effect below)
            pendingDeepLinkRef.current = url;
        });

        // Warm start: app already open, URL arrives while running
        const linkSubscription = Linking.addEventListener('url', ({ url }) => {
            if (!url) return;
            // Read the latest auth state directly from the Zustand store.
            const state = useAuthStore.getState();
            if (!state.isInitializing && state.user) {
                handleDeepLink(url);
            } else {
                pendingDeepLinkRef.current = url;
            }
        });

        return () => linkSubscription.remove();
    }, []);

    // Flush pending deep link once auth is resolved and user is logged in
    useEffect(() => {
        if (!isInitializing && user && pendingDeepLinkRef.current) {
            const url = pendingDeepLinkRef.current;
            pendingDeepLinkRef.current = null;
            handleDeepLink(url);
        }
    }, [isInitializing, user, handleDeepLink]);

    useEffect(() => {
        if (segments[0] === "(main)") {
            deepLinkNavigationInProgressRef.current = false;
        }
    }, [segments]);

    /**
     * Start a 30-second polling interval that refreshes the DM unread badge
     * while the app is in the foreground.  Safe to call multiple times — the
     * guard at the top prevents duplicate intervals.
     */
    const startDMPolling = useCallback(() => {
        if (dmPollRef.current) return; // already running
        dmPollRef.current = setInterval(() => {
            const _as = useAuthStore.getState();
            if (!_as.isInitializing && _as.user) {
                useDMStore.getState().fetchDMUnreadCount();
            }
        }, 30_000);
    }, []);

    /** Stop the DM badge polling interval (background / unmount). */
    const stopDMPolling = useCallback(() => {
        if (dmPollRef.current) {
            clearInterval(dmPollRef.current);
            dmPollRef.current = null;
        }
    }, []);

    // Auth-driven polling effect: start polling when auth completes and a
    // user is present; stop when the user logs out.
    // This handles the case where the app starts unauthenticated and the
    // user logs in without any background/foreground AppState transition,
    // which would otherwise leave the badge polling loop never started.
    useEffect(() => {
        if (!isInitializing && user) {
            startDMPolling();
        } else {
            stopDMPolling();
        }
    }, [isInitializing, user, startDMPolling, stopDMPolling]);

    useEffect(() => {
        // Load tokens and user data from SecureStore when the app starts
        initAuth();

        // Eagerly restore persisted sleep settings so they're ready before the
        // player mounts (avoids a race on cold start where sleepOnEpisodeEnd
        // reads as false before AsyncStorage resolves).
        useAudioStore.getState().loadSleepSettings();
        void hapticFeedback.loadPreference();
        // Fetch DM unread count on cold start (only when user is already authenticated)
        // and kick off the 30 s background polling loop.
        const _authState = useAuthStore.getState();
        if (!_authState.isInitializing && _authState.user) {
            useDMStore.getState().fetchDMUnreadCount();
            startDMPolling();
        }

        // Register session expired handler - will automatically redirect to login
        apiService.setSessionExpiredHandler(() => {
            logout();
            // The useEffect below will handle the redirect to login when user becomes null
        });

        // Check for draft recordings on initial mount
        checkForDrafts();

        // Listen to app state changes (foreground/background)
        const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                // App came to foreground - check for drafts again
                checkForDrafts();
                // Refresh DM unread badge immediately and restart the 30 s poll loop.
                const _as = useAuthStore.getState();
                if (!_as.isInitializing && _as.user) {
                    useDMStore.getState().fetchDMUnreadCount();
                    startDMPolling();
                }
            } else if (nextAppState === 'background' || nextAppState === 'inactive') {
                // Pause polling while the app is not visible — saves battery/data.
                stopDMPolling();
            }
        });

        // Handle notification tap - navigate to create screen
        let notificationSubscription = null;
        if (Notifications && Notifications.addNotificationResponseReceivedListener) {
            notificationSubscription = Notifications.addNotificationResponseReceivedListener(response => {
                const data = response.notification.request.content.data;
                if (data?.type === 'recording') {
                    // Navigate to create screen - router is ready at this point
                    router.push('/(main)/create');
                } else if (
                    data?.type === 'like' ||
                    data?.type === 'comment' ||
                    data?.type === 'new_episode'
                ) {
                    // Route to the episode detail screen for podcast-linked notification types.
                    // Covers: like, comment (activity on creator's episode) and new_episode
                    // (followed creator published). All three carry podcastId in the payload.
                    const podcastId = data?.podcastId ?? data?.podcast_id;
                    if (podcastId) {
                        router.push({ pathname: '/(main)/details', params: { id: podcastId } });
                    } else {
                        // Fallback: open notification inbox
                        router.push('/(main)/notifications');
                    }
                } else if (data?.type === 'dm') {
                    // Deep-link to the specific conversation if we have the sender's ID,
                    // otherwise fall back to the DM inbox.
                    const partnerId = data?.actorId;
                    if (partnerId) {
                        router.push({ pathname: '/(main)/chat-details', params: { partnerId } });
                    } else {
                        router.push('/(main)/messages');
                    }
                } else if (data?.type) {
                    // Unknown future type — open notifications as safe fallback
                    router.push('/(main)/notifications');
                }
            });
        }

        // Cleanup on unmount
        return () => {
            apiService.setSessionExpiredHandler(null);
            appStateSubscription.remove();
            stopDMPolling();
            if (notificationSubscription) {
                notificationSubscription.remove();
            }
        };
    }, [startDMPolling, stopDMPolling]);

    const checkForDrafts = async () => {
        // Skip if modal is already showing to prevent unnecessary state updates
        if (showDraftModal) {
            return;
        }
        
        try {
            const foundDraft = await protectionService.checkForDrafts();
            if (foundDraft && foundDraft.segments.length > 0) {
                setDraft(foundDraft);
                setShowDraftModal(true);
            }
        } catch (error) {
            Logger.error("Draft check failed:", error);
        }
    };

    const handleResumeDraft = () => {
        setShowDraftModal(false);
        // Navigate to create screen with draft data
        router.push({
            pathname: '/(main)/create',
            params: { mode: 'resume-draft', draftId: draft.id }
        });
    };

    const handleSaveDraft = () => {
        setShowDraftModal(false);
        // Navigate to save screen with draft
        router.push({
            pathname: '/(main)/create',
            params: { mode: 'save-draft', draftId: draft.id }
        });
    };

    const handleDiscardDraft = async () => {
        setShowDraftModal(false);
        await protectionService.clearDraft();
        setDraft(null);
    };

    // Register Expo push token once per user session (cold start or fresh login).
    // Depends on user?.id (a stable primitive) rather than the user object so that
    // unrelated profile updates don't trigger repeated registration calls.
    const userId = user?.id ?? null;
    useEffect(() => {
        if (!isInitializing && userId) {
            registerPushToken();
        }
    }, [isInitializing, userId]);

    useEffect(() => {
        // Don't do anything while initializing
        if (isInitializing) {
            return;
        }

        const inAuthGroup = segments[0] === "(auth)";
        const inMainGroup = segments[0] === "(main)";

        if (user && inAuthGroup) {
            if (
                pendingDeepLinkRef.current ||
                deepLinkNavigationInProgressRef.current
            ) {
                return;
            }

            // User is signed in but is in the auth group (e.g., login, register).
            // Redirect to the main home screen.
            router.replace("/(main)/home");
        } else if (!user && inMainGroup) {
            // User is not signed in but is in the main app group.
            // Redirect to the sign-in screen.
            router.replace("/");
        }
    }, [user, segments, isInitializing, router]);

    // Show loading screen while initializing auth
    if (isInitializing) {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#000",
                }}
            >
                <ActivityIndicator size="large" color="#D32F2F" />
            </View>
        );
    }

    return (
        <SafeAreaProvider>
            <ToastProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <PaperProvider>
                        <Stack screenOptions={{ headerShown: false }} />
                        <DraftRecoveryModal
                            visible={showDraftModal}
                            draft={draft}
                            onResume={handleResumeDraft}
                            onSave={handleSaveDraft}
                            onDiscard={handleDiscardDraft}
                        />
                    </PaperProvider>
                </GestureHandlerRootView>
            </ToastProvider>
        </SafeAreaProvider>
    );
}
