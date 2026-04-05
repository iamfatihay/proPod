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

    /**
     * Parse a deep link URL and navigate to the appropriate screen.
     *
     * Supported patterns:
     *   volo://podcast/{id}  →  /(main)/details?id={id}
     */
    const handleDeepLink = useCallback((url) => {
        if (!url) return;
        try {
            const parsed = Linking.parse(url);
            // hostname === 'podcast', path === '{id}'
            if (parsed.hostname === 'podcast') {
                const id = parsed.path ? parsed.path.replace(/^\//, '') : null;
                if (id) {
                    deepLinkNavigationInProgressRef.current = true;
                    Logger.info('Deep link: navigating to podcast', id);
                    router.push({ pathname: '/(main)/details', params: { id } });
                    return true;
                }
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
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentional mount-only

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

    useEffect(() => {
        // Load tokens and user data from SecureStore when the app starts
        initAuth();

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
                }
            });
        }

        // Cleanup on unmount
        return () => {
            apiService.setSessionExpiredHandler(null);
            appStateSubscription.remove();
            if (notificationSubscription) {
                notificationSubscription.remove();
            }
        };
    }, []);

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
