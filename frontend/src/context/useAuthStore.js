import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { getToken, deleteToken } from "../services/auth/tokenStorage";

const storeConfig = (set) => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    setUser: (user) => set({ user }, false, "auth/setUser"),
    setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }, false, "auth/setTokens"),
    logout: async () => {
        await deleteToken("accessToken");
        await deleteToken("refreshToken");
        set(
            { user: null, accessToken: null, refreshToken: null },
            false,
            "auth/logout"
        );
    },
    initAuth: async () => {
        const accessToken = await getToken("accessToken");
        const refreshToken = await getToken("refreshToken");
        set({ accessToken, refreshToken }, false, "auth/initAuth");
    },
});

const useAuthStore = create(devtools(storeConfig, { name: "AuthStore" }));

export default useAuthStore;
