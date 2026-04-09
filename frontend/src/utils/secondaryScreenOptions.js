import React from "react";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/theme";

export const buildSecondaryScreenOptions = ({
    router,
    title,
    backgroundColor = COLORS.card,
}) => ({
    title,
    headerShown: true,
    headerStyle: {
        backgroundColor,
    },
    headerTintColor: COLORS.text.primary,
    headerTitleStyle: {
        fontWeight: "500",
    },
    headerBackVisible: false,
    headerShadowVisible: false,
    headerLeft: () => (
        <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginLeft: 16 }}
            hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
            }}
        >
            <Ionicons
                name="arrow-back"
                size={24}
                color={COLORS.text.primary}
            />
        </TouchableOpacity>
    ),
});