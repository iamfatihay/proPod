import { create } from "zustand";
import { devtools } from "zustand/middleware";

const storeConfig = (set) => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    setUser: (user) => set({ user }, false, "auth/setUser"),
    setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }, false, "auth/setTokens"),
    logout: () =>
        set(
            { user: null, accessToken: null, refreshToken: null },
            false,
            "auth/logout"
        ),
});

const useAuthStore = create(devtools(storeConfig, { name: "AuthStore" }));

export default useAuthStore;
