import { Stack, useRouter, useSegments } from "expo-router";
import useAuthStore from "../src/context/useAuthStore";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import { ToastProvider } from "../src/components/Toast";
import { View, ActivityIndicator, AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import apiService from "../src/services/api/apiService";
import protectionService from "../src/services/recording/protectionService";
import DraftRecoveryModal from "../src/components/DraftRecoveryModal";
import * as Notifications from 'expo-notifications';
import Logger from "../src/utils/logger";
import clarityService from "../src/services/analytics/clarityService";

export default function Layout() {
    const { user, isInitializing } = useAuthStore();
    const router = useRouter();
    const segments = useSegments();
    const initAuth = useAuthStore((state) => state.initAuth);
    const logout = useAuthStore((state) => state.logout);

    const [draft, setDraft] = useState(null);
    const [showDraftModal, setShowDraftModal] = useState(false);

    useEffect(() => {
        // Initialize analytics
        clarityService.initialize();

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
