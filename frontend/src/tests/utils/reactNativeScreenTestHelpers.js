import React from "react";

const renderListPart = (part) => {
    if (!part) {
        return null;
    }

    if (typeof part === "function") {
        return React.createElement(part);
    }

    return part;
};

export const createRefreshControlMock = (
    reactNative,
    defaultAccessibilityLabel = null
) => {
    const MockView = reactNative.View || "View";
    const MockTouchableOpacity = reactNative.TouchableOpacity || MockView;

    return function RefreshControl({ onRefresh, ...props }) {
        return React.createElement(MockTouchableOpacity, {
            accessibilityRole: "button",
            accessibilityLabel: props.accessibilityLabel || defaultAccessibilityLabel,
            ...props,
            onPress: onRefresh,
        });
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

export const createFlatListMock = (reactNative) => {
    const MockView = reactNative.View || "View";

    return function FlatList({
        data = [],
        ListEmptyComponent,
        ListFooterComponent,
        ListHeaderComponent,
        refreshControl,
        renderItem,
        keyExtractor,
    }) {
        const items = Array.isArray(data) ? data : [];

        return React.createElement(
            MockView,
            null,
            renderListPart(ListHeaderComponent),
            refreshControl,
            items.length === 0
                ? renderListPart(ListEmptyComponent)
                : items.map((item, index) => React.createElement(
                    MockView,
                    {
                        key: keyExtractor?.(item, index) ?? String(item?.id ?? index),
                    },
                    renderItem?.({ item, index }) ?? null
                )),
            renderListPart(ListFooterComponent)
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