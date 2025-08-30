import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ErrorBoundary from "../ErrorBoundary";

// Mock component that throws an error
const ThrowError = () => {
    throw new Error("Test error");
};

describe("ErrorBoundary", () => {
    beforeEach(() => {
        // Suppress console.error for tests
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        console.error.mockRestore();
    });

    it("renders children when there is no error", () => {
        const { getByText } = render(
            <ErrorBoundary>
                <Text>Test content</Text>
            </ErrorBoundary>
        );

        expect(getByText("Test content")).toBeTruthy();
    });

    it("renders error UI when child throws an error", () => {
        const { getByText } = render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );

        expect(getByText("Oops! Something went wrong")).toBeTruthy();
        expect(getByText("Try Again")).toBeTruthy();
    });

    it("shows error details in development mode", () => {
        const originalDev = global.__DEV__;
        global.__DEV__ = true;

        const { getByText } = render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );

        expect(getByText("Error Details (Development):")).toBeTruthy();
        expect(getByText("Error: Test error")).toBeTruthy();

        global.__DEV__ = originalDev;
    });

    it("hides error details in production mode", () => {
        const originalDev = global.__DEV__;
        global.__DEV__ = false;

        const { queryByText } = render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );

        expect(queryByText("Error Details (Development):")).toBeNull();

        global.__DEV__ = originalDev;
    });

    it("resets error state when retry button is pressed", () => {
        const { getByText, queryByText } = render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );

        // Error should be visible
        expect(getByText("Oops! Something went wrong")).toBeTruthy();

        // Press retry button
        fireEvent.press(getByText("Try Again"));

        // Error should be hidden
        expect(queryByText("Oops! Something went wrong")).toBeNull();
    });
});
