import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { getToken, deleteToken } from "../services/auth/tokenStorage";
import apiService from "../services/api/apiService";
import Logger from "../utils/logger";

const storeConfig = (set) => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    isInitializing: true,
    setUser: (user) => set({ user }, false, "auth/setUser"),
    setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }, false, "auth/setTokens"),
    logout: async () => {
        await deleteToken("accessToken");
        await deleteToken("refreshToken");
        apiService.clearToken();
        set(
            { user: null, accessToken: null, refreshToken: null },
            false,
            "auth/logout"
        );
    },
    initAuth: async () => {
        try {
            const accessToken = await getToken("accessToken");
            const refreshToken = await getToken("refreshToken");

            if (accessToken) {
                // Set token in apiService
                apiService.setToken(accessToken);

                // Fetch user data
                try {
                    const userData = await apiService.getMe();
                    set(
                        {
                            user: userData,
                            accessToken,
                            refreshToken,
                            isInitializing: false,
                        },
                        false,
                        "auth/initAuth"
                    );
                } catch (error) {
                    // Token might be expired, clear it
                    await deleteToken("accessToken");
                    await deleteToken("refreshToken");
                    set(
                        {
                            user: null,
                            accessToken: null,
                            refreshToken: null,
                            isInitializing: false,
                        },
                        false,
                        "auth/initAuth/error"
                    );
                }
            } else {
                set(
                    {
                        accessToken: null,
                        refreshToken: null,
                        isInitializing: false,
                    },
                    false,
                    "auth/initAuth/noToken"
                );
            }
        } catch (error) {
            Logger.error("Auth initialization error:", error);
            set(
                {
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isInitializing: false,
                },
                false,
                "auth/initAuth/catch"
            );
        }
    },
});

const useAuthStore = create(devtools(storeConfig, { name: "AuthStore" }));

export default useAuthStore;
