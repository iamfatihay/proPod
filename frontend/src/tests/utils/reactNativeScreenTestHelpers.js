import React from "react";

export const createRefreshControlMock = (reactNative) => {
    const MockView = reactNative.View || "View";

    return function RefreshControl(props) {
        return React.createElement(MockView, props);
    };
};

export const createScrollViewWithRefreshControl = (
    reactNative,
    defaultTestId = "screen-scroll-view"
) => {
    const MockScrollView = reactNative.ScrollView || "ScrollView";

    return function ScrollView({
        children,
        refreshControl,
        testID = defaultTestId,
        ...props
    }) {
        return React.createElement(
            MockScrollView,
            { ...props, refreshControl, testID },
            refreshControl,
            children
        );
    };
};

export const createDeviceEventEmitterMock = () => ({
    addListener: jest.fn(() => ({
        remove: jest.fn(),
    })),
    emit: jest.fn(),
    removeAllListeners: jest.fn(),
});

export const createImmediateInteractionManager = (interactionManager = {}) => ({
    ...interactionManager,
    runAfterInteractions: jest.fn((callback) => {
        if (callback) {
            callback();
        }

        return {
            cancel: jest.fn(),
        };
    }),
});

export const createAnimatedSpringAndStaggerMocks = (animated = {}) => ({
    ...animated,
    spring: jest.fn(() => ({
        start: jest.fn(),
    })),
    stagger: jest.fn(() => ({
        start: jest.fn(),
    })),
});