import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";
import Logger from "../../utils/logger";

export const STORAGE_KEY = "@user_preferences/haptic_feedback";

let cachedEnabled = null;

const rememberEnabled = (enabled) => {
    cachedEnabled = Boolean(enabled);
    return cachedEnabled;
};

const parseStoredValue = (value) => value !== "0" && value !== "false";

const hapticFeedback = {
    async loadPreference() {
        if (cachedEnabled !== null) {
            return cachedEnabled;
        }

        try {
            const storedValue = await AsyncStorage.getItem(STORAGE_KEY);
            if (storedValue == null) {
                return rememberEnabled(true);
            }
            return rememberEnabled(parseStoredValue(storedValue));
        } catch (error) {
            Logger.warn("Failed to load haptic feedback preference:", error);
            return rememberEnabled(true);
        }
    },

    async setEnabled(enabled) {
        const normalizedEnabled = rememberEnabled(enabled);

        try {
            await AsyncStorage.setItem(STORAGE_KEY, normalizedEnabled ? "1" : "0");
        } catch (error) {
            Logger.warn("Failed to save haptic feedback preference:", error);
        }

        return normalizedEnabled;
    },

    async impact(style = Haptics.ImpactFeedbackStyle.Light) {
        if (Platform.OS === "web") {
            return false;
        }

        const enabled = await this.loadPreference();
        if (!enabled) {
            return false;
        }

        try {
            if (Haptics?.impactAsync) {
                await Haptics.impactAsync(style);
                return true;
            }

            if (Vibration?.vibrate) {
                Vibration.vibrate(10);
                return true;
            }
        } catch (error) {
            Logger.warn("Failed to trigger haptic feedback:", error);
        }

        return false;
    },

    async vibrate(pattern = 10) {
        if (Platform.OS === "web") {
            return false;
        }

        const enabled = await this.loadPreference();
        if (!enabled || !Vibration?.vibrate) {
            return false;
        }

        try {
            Vibration.vibrate(pattern);
            return true;
        } catch (error) {
            Logger.warn("Failed to vibrate device:", error);
            return false;
        }
    },

    __resetForTests() {
        cachedEnabled = null;
    },
};

export default hapticFeedback;
