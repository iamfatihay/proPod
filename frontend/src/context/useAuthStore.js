import { create } from "zustand";
import { devtools } from "zustand/middleware";

const storeConfig = (set) => ({
    user: null,
    setUser: (user) => set({ user }, false, "auth/setUser"),
    logout: () => set({ user: null }, false, "auth/logout"),
});

const useAuthStore = create(devtools(storeConfig, { name: "AuthStore" }));

export default useAuthStore;
