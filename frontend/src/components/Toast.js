import React, { createContext, useContext, useState, useCallback } from "react";
import { View, Text, Animated } from "react-native";

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

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toast.visible && (
                <Animated.View
                    style={{
                        position: "absolute",
                        top: 100,
                        left: 0,
                        right: 0,
                        alignItems: "center",
                        opacity: fadeAnim,
                        zIndex: 9999,
                    }}
                >
                    <View
                        className={`px-6 py-3 rounded-xl shadow-lg ${
                            toast.type === "success" ? "bg-primary" : "bg-error"
                        }`}
                    >
                        <Text className="text-white font-semibold text-base">
                            {toast.message}
                        </Text>
                    </View>
                </Animated.View>
            )}
        </ToastContext.Provider>
    );
};
