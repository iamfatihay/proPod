// Mock for react-native-paper
const Surface = jest
    .fn()
    .mockImplementation(({ children, style, ...props }) => {
        return {
            type: "Surface",
            props: { children, style, ...props },
        };
    });

const Card = jest.fn().mockImplementation(({ children, style, ...props }) => {
    return {
        type: "Card",
        props: { children, style, ...props },
    };
});

const Button = jest
    .fn()
    .mockImplementation(({ children, onPress, style, ...props }) => {
        return {
            type: "Button",
            props: { children, onPress, style, ...props },
        };
    });

const TextInput = jest
    .fn()
    .mockImplementation(({ value, onChangeText, style, ...props }) => {
        return {
            type: "TextInput",
            props: { value, onChangeText, style, ...props },
        };
    });

const Chip = jest
    .fn()
    .mockImplementation(({ children, onPress, style, ...props }) => {
        return {
            type: "Chip",
            props: { children, onPress, style, ...props },
        };
    });

const Avatar = jest
    .fn()
    .mockImplementation(({ source, size, style, ...props }) => {
        return {
            type: "Avatar",
            props: { source, size, style, ...props },
        };
    });

const Divider = jest.fn().mockImplementation(({ style, ...props }) => {
    return {
        type: "Divider",
        props: { style, ...props },
    };
});

const List = {
    Item: jest
        .fn()
        .mockImplementation(
            ({ title, description, left, right, onPress, ...props }) => {
                return {
                    type: "List.Item",
                    props: {
                        title,
                        description,
                        left,
                        right,
                        onPress,
                        ...props,
                    },
                };
            }
        ),
    Section: jest.fn().mockImplementation(({ title, children, ...props }) => {
        return {
            type: "List.Section",
            props: { title, children, ...props },
        };
    }),
};

const FAB = jest
    .fn()
    .mockImplementation(({ icon, onPress, style, ...props }) => {
        return {
            type: "FAB",
            props: { icon, onPress, style, ...props },
        };
    });

const Portal = {
    Provider: jest.fn().mockImplementation(({ children }) => children),
    Host: jest.fn().mockImplementation(({ children }) => children),
};

const Modal = jest
    .fn()
    .mockImplementation(({ visible, onDismiss, children, ...props }) => {
        return {
            type: "Modal",
            props: { visible, onDismiss, children, ...props },
        };
    });

const Snackbar = jest
    .fn()
    .mockImplementation(({ visible, onDismiss, children, ...props }) => {
        return {
            type: "Snackbar",
            props: { visible, onDismiss, children, ...props },
        };
    });

export {
    Surface,
    Card,
    Button,
    TextInput,
    Chip,
    Avatar,
    Divider,
    List,
    FAB,
    Portal,
    Modal,
    Snackbar,
};
