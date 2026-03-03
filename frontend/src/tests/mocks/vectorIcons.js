// Mock for @expo/vector-icons
// Components must return null (valid React element), not plain objects.
const MaterialCommunityIcons = jest.fn().mockReturnValue(null);
const Ionicons = jest.fn().mockReturnValue(null);
const AntDesign = jest.fn().mockReturnValue(null);
const FontAwesome = jest.fn().mockReturnValue(null);
const Feather = jest.fn().mockReturnValue(null);

export { MaterialCommunityIcons, Ionicons, AntDesign, FontAwesome, Feather };
