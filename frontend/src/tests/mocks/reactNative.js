// Mock for react-native
module.exports = {
    Platform: {
        OS: "ios",
        select: (options) => options.ios || options.default,
    },

    Dimensions: {
        get: () => ({ width: 375, height: 812 }),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    },

    StyleSheet: {
        create: (styles) => styles,
        flatten: (style) => style,
    },

    Text: "Text",
    View: "View",
    TouchableOpacity: "TouchableOpacity",
    TextInput: "TextInput",
    ScrollView: "ScrollView",
    Image: "Image",
    FlatList: "FlatList",
    ActivityIndicator: "ActivityIndicator",
    Switch: "Switch",
    Modal: "Modal",
    Pressable: "Pressable",
    SafeAreaView: "SafeAreaView",
    TouchableHighlight: "TouchableHighlight",
    TouchableWithoutFeedback: "TouchableWithoutFeedback",

    Alert: {
        alert: jest.fn(),
    },

    Vibration: {
        vibrate: jest.fn(),
        cancel: jest.fn(),
    },

    Animated: {
        Value: jest.fn(() => ({
            setValue: jest.fn(),
            addListener: jest.fn(),
            removeListener: jest.fn(),
            interpolate: jest.fn(),
        })),
        timing: jest.fn(() => ({
            start: jest.fn(),
        })),
        View: "AnimatedView",
    },

    Keyboard: {
        dismiss: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
    },

    Linking: {
        openURL: jest.fn(),
        canOpenURL: jest.fn(() => Promise.resolve(true)),
    },

    BackHandler: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    },
};
