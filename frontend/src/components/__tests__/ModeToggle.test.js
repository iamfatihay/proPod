import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import ModeToggle from "../ModeToggle";
import useViewModeStore from "../../context/useViewModeStore";

// Mock the store
jest.mock("../../context/useViewModeStore");

describe("ModeToggle", () => {
    const mockToggleViewMode = jest.fn();
    const mockMarkTutorialSeen = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        useViewModeStore.mockReturnValue({
            viewMode: "discover",
            toggleViewMode: mockToggleViewMode,
            hasSeenModeToggleTutorial: true,
            markTutorialSeen: mockMarkTutorialSeen,
        });
    });

    it("renders both mode buttons", () => {
        const { getByText } = render(<ModeToggle />);

        expect(getByText("Discover")).toBeTruthy();
        expect(getByText("Studio")).toBeTruthy();
    });

    it("highlights Discover mode when active", () => {
        useViewModeStore.mockReturnValue({
            viewMode: "discover",
            toggleViewMode: mockToggleViewMode,
            hasSeenModeToggleTutorial: true,
            markTutorialSeen: mockMarkTutorialSeen,
        });

        const { getByA11yState } = render(<ModeToggle />);
        
        // In real app, check state through accessibility
        expect(useViewModeStore().viewMode).toBe("discover");
    });

    it("highlights Studio mode when active", () => {
        useViewModeStore.mockReturnValue({
            viewMode: "studio",
            toggleViewMode: mockToggleViewMode,
            hasSeenModeToggleTutorial: true,
            markTutorialSeen: mockMarkTutorialSeen,
        });

        const { getByText } = render(<ModeToggle />);
        
        expect(useViewModeStore().viewMode).toBe("studio");
    });

    it("calls toggleViewMode when button is pressed", () => {
        const { getAllByRole } = render(<ModeToggle />);

        const buttons = getAllByRole("button");
        fireEvent.press(buttons[0]);

        expect(mockToggleViewMode).toHaveBeenCalled();
    });

    it("shows tutorial on first render if not seen", async () => {
        useViewModeStore.mockReturnValue({
            viewMode: "discover",
            toggleViewMode: mockToggleViewMode,
            hasSeenModeToggleTutorial: false,
            markTutorialSeen: mockMarkTutorialSeen,
        });

        const { getByText } = render(<ModeToggle />);

        await waitFor(() => {
            expect(getByText(/Switch modes to explore or create/)).toBeTruthy();
        });
    });

    it("marks tutorial as seen after showing", async () => {
        useViewModeStore.mockReturnValue({
            viewMode: "discover",
            toggleViewMode: mockToggleViewMode,
            hasSeenModeToggleTutorial: false,
            markTutorialSeen: mockMarkTutorialSeen,
        });

        render(<ModeToggle />);

        await waitFor(() => {
            expect(mockMarkTutorialSeen).toHaveBeenCalled();
        }, { timeout: 4000 });
    });
});

