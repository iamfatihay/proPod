import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const isWeb = Platform.OS === "web";

// Web builds use localStorage since expo-secure-store is mobile-only.
// Production web auth should migrate to HttpOnly cookies for better security.
const getWebStorage = () => {
    if (
        typeof globalThis === "undefined" ||
        typeof globalThis.localStorage === "undefined"
    ) {
        return null;
    }

    return globalThis.localStorage;
};

export async function saveToken(key, value) {
    if (!value) {
        return;
    }

    if (isWeb) {
        try {
            const storage = getWebStorage();
            storage?.setItem(key, value);
        } catch {
            // localStorage can be unavailable or blocked in some web runtimes.
        }
        return;
    }

    await SecureStore.setItemAsync(key, value);
}

export async function getToken(key) {
    if (isWeb) {
        try {
            const storage = getWebStorage();
            return storage?.getItem(key) || null;
        } catch {
            return null;
        }
    }

    return await SecureStore.getItemAsync(key);
}

export async function deleteToken(key) {
    if (isWeb) {
        try {
            const storage = getWebStorage();
            storage?.removeItem(key);
        } catch {
            // Ignore web storage cleanup failures.
        }
        return;
    }

    await SecureStore.deleteItemAsync(key);
}