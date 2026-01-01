import { Stack, useRouter, useSegments } from "expo-router";
import useAuthStore from "../src/context/useAuthStore";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import { ToastProvider } from "../src/components/Toast";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import apiService from "../src/services/api/apiService";

export default function Layout() {
    const { user, isInitializing } = useAuthStore();
    const router = useRouter();
    const segments = useSegments();
    const initAuth = useAuthStore((state) => state.initAuth);
    const logout = useAuthStore((state) => state.logout);

    useEffect(() => {
        // Load tokens and user data from SecureStore when the app starts
        initAuth();

        // Register session expired handler - will automatically redirect to login
        apiService.setSessionExpiredHandler(() => {
            logout();
            // The useEffect below will handle the redirect to login when user becomes null
        });

        // Cleanup on unmount
        return () => {
            apiService.setSessionExpiredHandler(null);
        };
    }, []);

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
                    </PaperProvider>
                </GestureHandlerRootView>
            </ToastProvider>
        </SafeAreaProvider>
    );
}
