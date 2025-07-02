import * as SecureStore from "expo-secure-store";

export async function saveToken(key, value) {
    if (value) {
        await SecureStore.setItemAsync(key, value);
    }
}

export async function getToken(key) {
    return await SecureStore.getItemAsync(key);
}

export async function deleteToken(key) {
    await SecureStore.deleteItemAsync(key);
}
