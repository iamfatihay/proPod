import { Stack, useRouter, useSegments } from "expo-router";
import { cssInterop } from "react-native-css-interop";
import useAuthStore from "../src/context/useAuthStore";
import { useEffect } from "react";

cssInterop(Stack, {
    className: "style",
});

export default function Layout() {
    const { user } = useAuthStore();
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        const inAuthGroup = segments[0] === "(auth)";
        const inMainGroup = segments[0] === "(main)";

        // Prevent navigation before the router is ready.
        if (segments.length === 0) {
            return;
        }

        if (user && inAuthGroup) {
            // User is signed in but is in the auth group (e.g., login, register).
            // Redirect to the main home screen.
            router.replace("/(main)/home");
        } else if (!user && inMainGroup) {
            // User is not signed in but is in the main app group.
            // Redirect to the sign-in screen.
            router.replace("/");
        }
    }, [user, segments]);

    return <Stack screenOptions={{ headerShown: false }} />;
}
