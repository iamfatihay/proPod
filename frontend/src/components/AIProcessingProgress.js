import React, { useEffect, useRef } from "react";
import { View, Text, Animated, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const AIProcessingProgress = ({
    isVisible = false,
    currentStep = "initializing",
    progress = 0,
    processingTime = 0,
}) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isVisible) {
            // Start pulse animation
            const pulseAnimation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulseAnimation.start();

            return () => pulseAnimation.stop();
        }
    }, [isVisible]);

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: progress / 100,
            duration: 500,
            useNativeDriver: false,
        }).start();
    }, [progress]);

    if (!isVisible) {
        return null;
    }

    const getStepInfo = (step) => {
        const steps = {
            initializing: {
                title: "Initializing AI Services",
                description: "Setting up audio processing...",
                icon: "robot",
                color: "#888888", // text-muted
            },
            uploading: {
                title: "Uploading Audio",
                description: "Preparing audio file for processing...",
                icon: "cloud-upload",
                color: "#3B82F6", // info
            },
            enhancing: {
                title: "Enhancing Audio Quality",
                description: "Reducing noise and improving clarity...",
                icon: "waveform",
                color: "#F59E0B", // warning
            },
            transcribing: {
                title: "Transcribing Speech",
                description: "Converting speech to text...",
                icon: "text-to-speech",
                color: "#10B981", // success
            },
            analyzing: {
                title: "Analyzing Content",
                description: "Extracting keywords and generating insights...",
                icon: "brain",
                color: "#8B5CF6", // purple variant
            },
            finalizing: {
                title: "Finalizing Results",
                description: "Preparing analysis results...",
                icon: "check-circle",
                color: "#059669", // success variant
            },
        };

        return steps[step] || steps.initializing;
    };

    const stepInfo = getStepInfo(currentStep);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <View className="flex-1 justify-center items-center p-6">
            {/* AI Robot Animation */}
            <Animated.View
                style={{
                    transform: [{ scale: pulseAnim }],
                }}
                className="mb-8"
            >
                <View className="w-24 h-24 rounded-full bg-primary/20 items-center justify-center">
                    <MaterialCommunityIcons
                        name="robot"
                        size={48}
                        color="#10B981"
                    />
                </View>
            </Animated.View>

            {/* Current Step */}
            <View className="items-center mb-6">
                <View className="flex-row items-center mb-2">
                    <MaterialCommunityIcons
                        name={stepInfo.icon}
                        size={20}
                        color={stepInfo.color}
                    />
                    <Text className="text-lg font-semibold text-text-primary ml-2">
                        {stepInfo.title}
                    </Text>
                </View>
                <Text className="text-text-secondary text-center">
                    {stepInfo.description}
                </Text>
            </View>

            {/* Progress Bar */}
            <View className="w-full mb-6">
                <View className="w-full h-2 bg-background rounded-full overflow-hidden">
                    <Animated.View
                        className="h-full bg-primary rounded-full"
                        style={{
                            width: progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ["0%", "100%"],
                            }),
                        }}
                    />
                </View>
                <View className="flex-row justify-between mt-2">
                    <Text className="text-text-secondary text-sm">
                        {progress}% Complete
                    </Text>
                    <Text className="text-text-secondary text-sm">
                        {formatTime(processingTime)}
                    </Text>
                </View>
            </View>

            {/* Processing Steps Indicator */}
            <View className="w-full">
                <Text className="text-text-primary font-medium mb-3 text-center">
                    Processing Steps
                </Text>
                <View className="space-y-2">
                    {[
                        { key: "enhancing", label: "Audio Enhancement" },
                        { key: "transcribing", label: "Speech Recognition" },
                        { key: "analyzing", label: "Content Analysis" },
                    ].map((item, index) => {
                        const isCompleted =
                            (currentStep === "transcribing" &&
                                item.key === "enhancing") ||
                            (currentStep === "analyzing" &&
                                ["enhancing", "transcribing"].includes(
                                    item.key
                                )) ||
                            (currentStep === "finalizing" &&
                                [
                                    "enhancing",
                                    "transcribing",
                                    "analyzing",
                                ].includes(item.key));

                        const isActive = currentStep === item.key;
                        const isPending = !isCompleted && !isActive;

                        return (
                            <View
                                key={item.key}
                                className="flex-row items-center"
                            >
                                <View
                                    className={`w-4 h-4 rounded-full mr-3 ${
                                        isCompleted
                                            ? "bg-success"
                                            : isActive
                                            ? "bg-primary"
                                            : "bg-background"
                                    }`}
                                >
                                    {isCompleted && (
                                        <MaterialCommunityIcons
                                            name="check"
                                            size={12}
                                            color="white"
                                            style={{
                                                alignSelf: "center",
                                                marginTop: 1,
                                            }}
                                        />
                                    )}
                                    {isActive && (
                                        <ActivityIndicator
                                            size="small"
                                            color="white"
                                            style={{
                                                alignSelf: "center",
                                                marginTop: -2,
                                            }}
                                        />
                                    )}
                                </View>
                                <Text
                                    className={`${
                                        isCompleted
                                            ? "text-success"
                                            : isActive
                                            ? "text-primary"
                                            : "text-text-secondary"
                                    }`}
                                >
                                    {item.label}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Fun Facts or Tips */}
            <View className="mt-8 bg-card rounded-lg p-4 w-full">
                <View className="flex-row items-center mb-2">
                    <MaterialCommunityIcons
                        name="lightbulb"
                        size={16}
                        color="#F59E0B"
                    />
                    <Text className="text-warning font-medium ml-2">
                        Did you know?
                    </Text>
                </View>
                <Text className="text-text-secondary text-sm">
                    {getCurrentTip(currentStep)}
                </Text>
            </View>
        </View>
    );
};

const getCurrentTip = (step) => {
    const tips = {
        initializing:
            "AI can process multiple languages simultaneously and automatically detect the primary language.",
        uploading:
            "Our AI works best with clear audio recordings. Background noise will be automatically reduced.",
        enhancing:
            "Audio enhancement can improve quality by up to 40% while reducing file size.",
        transcribing:
            "Speech recognition accuracy is typically 95%+ for clear recordings in supported languages.",
        analyzing:
            "Content analysis can extract insights that would take humans hours to identify manually.",
        finalizing:
            "AI-generated summaries can increase podcast discoverability by 60%.",
    };

    return tips[step] || tips.initializing;
};

export default AIProcessingProgress;
