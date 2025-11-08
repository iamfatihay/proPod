import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * View Mode Store - Manages user interface mode (Discover vs Studio)
 *
 * Modes:
 * - discover: Listener experience (explore, listen, discover)
 * - studio: Creator experience (record, manage, analytics)
 */

const storeConfig = (set, get) => ({
    // Current view mode
    viewMode: "discover", // 'discover' | 'studio'

    // User preferences
    defaultMode: "discover",
    hasSeenModeToggleTutorial: false,

    // Actions
    setViewMode: (mode) => {
        if (mode !== "discover" && mode !== "studio") {
            console.warn("Invalid view mode:", mode);
            return;
        }
        set({ viewMode: mode }, false, "viewMode/setViewMode");
    },

    toggleViewMode: () => {
        const currentMode = get().viewMode;
        const newMode = currentMode === "discover" ? "studio" : "discover";
        set({ viewMode: newMode }, false, "viewMode/toggleViewMode");
    },

    setDefaultMode: (mode) => {
        set({ defaultMode: mode }, false, "viewMode/setDefaultMode");
    },

    markTutorialSeen: () => {
        set(
            { hasSeenModeToggleTutorial: true },
            false,
            "viewMode/markTutorialSeen"
        );
    },

    resetPreferences: () => {
        set(
            {
                viewMode: "discover",
                defaultMode: "discover",
                hasSeenModeToggleTutorial: false,
            },
            false,
            "viewMode/resetPreferences"
        );
    },
});

// Create store with persistence and devtools
const useViewModeStore = create(
    devtools(
        persist(storeConfig, {
            name: "view-mode-storage",
            storage: createJSONStorage(() => AsyncStorage),
        }),
        { name: "ViewModeStore" }
    )
);

export default useViewModeStore;
