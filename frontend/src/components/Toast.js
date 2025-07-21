import React, { createContext, useContext, useState, useCallback } from "react";
import { View, Text, Animated, Platform, StatusBar } from "react-native";

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState({
        visible: false,
        message: "",
        type: "success",
    });
    const [fadeAnim] = useState(new Animated.Value(0));

    const showToast = useCallback(
        (message, type = "success") => {
            setToast({ visible: true, message, type });
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
            setTimeout(() => {
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }).start(() => setToast((t) => ({ ...t, visible: false })));
            }, 2500);
        },
        [fadeAnim]
    );

    // Calculate safe top position for different platforms
    const getTopPosition = () => {
        if (Platform.OS === "ios") {
            return StatusBar.currentHeight ? StatusBar.currentHeight + 60 : 100;
        } else {
            return StatusBar.currentHeight ? StatusBar.currentHeight + 40 : 80;
        }
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toast.visible && (
                <Animated.View
                    style={{
                        position: "absolute",
                        top: getTopPosition(),
                        left: 20,
                        right: 20,
                        alignItems: "center",
                        opacity: fadeAnim,
                        zIndex: 9999,
                        // iOS specific shadow
                        ...(Platform.OS === "ios" && {
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.3,
                            shadowRadius: 4,
                        }),
                    }}
                    accessible={true}
                    accessibilityRole="alert"
                    accessibilityLabel={`${
                        toast.type === "success" ? "Success" : "Error"
                    }: ${toast.message}`}
                >
                    <View
                        style={{
                            paddingHorizontal: 24,
                            paddingVertical: 12,
                            borderRadius: 12,
                            backgroundColor:
                                toast.type === "success"
                                    ? "#D32F2F"
                                    : "#EF4444",
                            maxWidth: "90%",
                            // Android elevation
                            ...(Platform.OS === "android" && {
                                elevation: 8,
                            }),
                        }}
                    >
                        <Text
                            style={{
                                color: "#FFFFFF",
                                fontWeight: "600",
                                fontSize: 16,
                                textAlign: "center",
                            }}
                            numberOfLines={3}
                        >
                            {toast.message}
                        </Text>
                    </View>
                </Animated.View>
            )}
        </ToastContext.Provider>
    );
};
