import { create } from "zustand";
import { devtools } from "zustand/middleware";

const useAuthStore = create(
    devtools((set) => ({
        user: null,
        setUser: (user) => set({ user }, false, "auth/setUser"),
        logout: () => set({ user: null }, false, "auth/logout"),
    }))
);

export default useAuthStore;
