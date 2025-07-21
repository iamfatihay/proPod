// Mock for @expo/vector-icons
import React from "react";
import { Text } from "react-native";

const createIconComponent = (iconFamily) => {
    return React.forwardRef((props, ref) => {
        const {
            name,
            size = 24,
            color = "black",
            testID,
            ...otherProps
        } = props;

        return (
            <Text
                ref={ref}
                testID={testID || `icon-${iconFamily}-${name}`}
                style={[
                    {
                        fontSize: size,
                        color: color,
                        fontFamily: iconFamily,
                    },
                    props.style,
                ]}
                {...otherProps}
            >
                {name || "●"}
            </Text>
        );
    });
};

// Create mock components for different icon families
const MaterialIcons = createIconComponent("MaterialIcons");
const MaterialCommunityIcons = createIconComponent("MaterialCommunityIcons");
const Ionicons = createIconComponent("Ionicons");
const Feather = createIconComponent("Feather");
const FontAwesome = createIconComponent("FontAwesome");
const FontAwesome5 = createIconComponent("FontAwesome5");
const AntDesign = createIconComponent("AntDesign");
const Entypo = createIconComponent("Entypo");
const EvilIcons = createIconComponent("EvilIcons");
const Foundation = createIconComponent("Foundation");
const Octicons = createIconComponent("Octicons");
const SimpleLineIcons = createIconComponent("SimpleLineIcons");
const Zocial = createIconComponent("Zocial");

// Set display names for better debugging
MaterialIcons.displayName = "MaterialIcons";
MaterialCommunityIcons.displayName = "MaterialCommunityIcons";
Ionicons.displayName = "Ionicons";
Feather.displayName = "Feather";
FontAwesome.displayName = "FontAwesome";
FontAwesome5.displayName = "FontAwesome5";
AntDesign.displayName = "AntDesign";
Entypo.displayName = "Entypo";
EvilIcons.displayName = "EvilIcons";
Foundation.displayName = "Foundation";
Octicons.displayName = "Octicons";
SimpleLineIcons.displayName = "SimpleLineIcons";
Zocial.displayName = "Zocial";

module.exports = {
    MaterialIcons,
    MaterialCommunityIcons,
    Ionicons,
    Feather,
    FontAwesome,
    FontAwesome5,
    AntDesign,
    Entypo,
    EvilIcons,
    Foundation,
    Octicons,
    SimpleLineIcons,
    Zocial,
};
