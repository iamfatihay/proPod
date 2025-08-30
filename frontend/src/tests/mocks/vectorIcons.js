// Mock for @expo/vector-icons
const MaterialCommunityIcons = jest
    .fn()
    .mockImplementation(({ name, size, color, style }) => {
        return {
            type: "MaterialCommunityIcons",
            props: { name, size, color, style },
        };
    });

const Ionicons = jest
    .fn()
    .mockImplementation(({ name, size, color, style }) => {
        return {
            type: "Ionicons",
            props: { name, size, color, style },
        };
    });

const AntDesign = jest
    .fn()
    .mockImplementation(({ name, size, color, style }) => {
        return {
            type: "AntDesign",
            props: { name, size, color, style },
        };
    });

const FontAwesome = jest
    .fn()
    .mockImplementation(({ name, size, color, style }) => {
        return {
            type: "FontAwesome",
            props: { name, size, color, style },
        };
    });

const Feather = jest.fn().mockImplementation(({ name, size, color, style }) => {
    return {
        type: "Feather",
        props: { name, size, color, style },
    };
});

export { MaterialCommunityIcons, Ionicons, AntDesign, FontAwesome, Feather };
