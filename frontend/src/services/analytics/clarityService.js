import * as Clarity from "@microsoft/react-native-clarity";
import Constants from "expo-constants";
import Logger from "../../utils/logger";

/**
 * Clarity Analytics Service
 *
 * Wraps Microsoft Clarity SDK for session replay and heatmaps.
 * Usage:
 *   - clarityService.initialize() — call once on app start (root layout)
 *   - clarityService.setUser(id, username) — call after successful login
 *   - clarityService.clearUser() — call on logout
 */

const PROJECT_ID =
    Constants.expoConfig?.extra?.clarityProjectId || "w0q4nzuzaa";

let isInitialized = false;

/**
 * Initialize Clarity. Call once when the app starts.
 * Safe to call multiple times (idempotent).
 */
export function initializeClarity() {
    if (isInitialized) return;

    try {
        Clarity.initialize(PROJECT_ID, {
            logLevel: __DEV__ ? Clarity.LogLevel.Verbose : Clarity.LogLevel.None,
        });
        isInitialized = true;
        Logger.log("[Clarity] Initialized with project:", PROJECT_ID);
    } catch (error) {
        Logger.error("[Clarity] Initialization failed:", error);
    }
}

/**
 * Identify the current user. Call after successful login or auth restore.
 * @param {string|number} userId - Your backend user ID
 * @param {string} [username] - Optional display name / username
 */
export function setClarityUser(userId, username) {
    if (!isInitialized) return;

    try {
        const id = String(userId);
        Clarity.setCustomUserId(id);
        if (username) {
            Clarity.setCustomSessionId(`user_${id}`);
        }
        Logger.log("[Clarity] User set:", id, username);
    } catch (error) {
        Logger.error("[Clarity] setUser failed:", error);
    }
}

/**
 * Clear user identification. Call on logout.
 */
export function clearClarityUser() {
    if (!isInitialized) return;

    try {
        Clarity.setCustomUserId("anonymous");
        Logger.log("[Clarity] User cleared");
    } catch (error) {
        Logger.error("[Clarity] clearUser failed:", error);
    }
}

const clarityService = {
    initialize: initializeClarity,
    setUser: setClarityUser,
    clearUser: clearClarityUser,
};

export default clarityService;
