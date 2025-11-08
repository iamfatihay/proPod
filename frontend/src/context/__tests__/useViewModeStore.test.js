import { renderHook, act } from "@testing-library/react-native";
import useViewModeStore from "../useViewModeStore";

describe("useViewModeStore", () => {
    beforeEach(() => {
        // Reset store to default state
        const { result } = renderHook(() => useViewModeStore());
        act(() => {
            result.current.resetPreferences();
        });
    });

    it("initializes with discover mode", () => {
        const { result } = renderHook(() => useViewModeStore());
        expect(result.current.viewMode).toBe("discover");
    });

    it("toggles between discover and studio modes", () => {
        const { result } = renderHook(() => useViewModeStore());

        act(() => {
            result.current.toggleViewMode();
        });
        expect(result.current.viewMode).toBe("studio");

        act(() => {
            result.current.toggleViewMode();
        });
        expect(result.current.viewMode).toBe("discover");
    });

    it("sets view mode directly", () => {
        const { result } = renderHook(() => useViewModeStore());

        act(() => {
            result.current.setViewMode("studio");
        });
        expect(result.current.viewMode).toBe("studio");
    });

    it("ignores invalid view modes", () => {
        const { result } = renderHook(() => useViewModeStore());
        const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

        act(() => {
            result.current.setViewMode("invalid");
        });

        expect(result.current.viewMode).toBe("discover"); // Should remain unchanged
        expect(consoleSpy).toHaveBeenCalledWith("Invalid view mode:", "invalid");

        consoleSpy.mockRestore();
    });

    it("sets default mode", () => {
        const { result } = renderHook(() => useViewModeStore());

        act(() => {
            result.current.setDefaultMode("studio");
        });

        expect(result.current.defaultMode).toBe("studio");
    });

    it("marks tutorial as seen", () => {
        const { result } = renderHook(() => useViewModeStore());

        expect(result.current.hasSeenModeToggleTutorial).toBe(false);

        act(() => {
            result.current.markTutorialSeen();
        });

        expect(result.current.hasSeenModeToggleTutorial).toBe(true);
    });

    it("resets preferences to default", () => {
        const { result } = renderHook(() => useViewModeStore());

        // Modify all values
        act(() => {
            result.current.setViewMode("studio");
            result.current.setDefaultMode("studio");
            result.current.markTutorialSeen();
        });

        // Reset
        act(() => {
            result.current.resetPreferences();
        });

        expect(result.current.viewMode).toBe("discover");
        expect(result.current.defaultMode).toBe("discover");
        expect(result.current.hasSeenModeToggleTutorial).toBe(false);
    });

    it("persists state across re-renders", () => {
        const { result, rerender } = renderHook(() => useViewModeStore());

        act(() => {
            result.current.setViewMode("studio");
        });

        rerender();

        expect(result.current.viewMode).toBe("studio");
    });
});

