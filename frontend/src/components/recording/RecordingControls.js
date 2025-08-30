import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Platform,
    Animated,
    Dimensions,
    Alert,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import AudioService from "../../services/audio/AudioService";

const { width: screenWidth } = Dimensions.get("window");

const RecordingControls = ({
    onRecordingStart,
    onRecordingStop,
    onRecordingPause,
    onRecordingResume,
    onAIAssistToggle,
    isAIEnabled = false,
    disabled = false,
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [recordingAnimation] = useState(new Animated.Value(1));
    const [waveAnimation] = useState(new Animated.Value(0));

    useEffect(() => {
        let interval;
        if (isRecording && !isPaused) {
            // Start recording animation
            Animated.loop(
                Animated.sequence([
                    Animated.timing(recordingAnimation, {
                        toValue: 1.2,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(recordingAnimation, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            // Start wave animation
            Animated.loop(
                Animated.timing(waveAnimation, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                })
            ).start();

            // Update duration timer
            interval = setInterval(() => {
                const status = AudioService.getRecordingStatus();
                setDuration(status.duration);
            }, 1000);
        } else {
            recordingAnimation.stopAnimation();
            waveAnimation.stopAnimation();
            if (interval) {
                clearInterval(interval);
            }
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isRecording, isPaused]);

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs
            .toString()
            .padStart(2, "0")}`;
    };

    const handleRecordPress = async () => {
        console.log("🎵 RecordingControls: handleRecordPress called", {
            disabled,
            isRecording,
            isPaused,
            duration,
        });

        if (disabled) {
            console.log("❌ Recording disabled, skipping");
            return;
        }

        try {
            if (!isRecording) {
                console.log("▶️ Starting recording via AudioService...");
                // Start recording
                const success = await AudioService.startRecording();
                console.log("🎵 AudioService.startRecording result:", success);

                if (success) {
                    console.log("✅ Recording started, updating UI state...");
                    setIsRecording(true);
                    setIsPaused(false);
                    setDuration(0);
                    onRecordingStart && onRecordingStart();
                } else {
                    console.warn("❌ Failed to start recording");
                }
            } else {
                console.log("⏹️ Stopping recording via AudioService...");
                // Stop recording
                const uri = await AudioService.stopRecording();
                console.log("🎵 AudioService.stopRecording result URI:", uri);

                if (uri) {
                    console.log("✅ Recording stopped, updating UI state...");
                    setIsRecording(false);
                    setIsPaused(false);
                    setDuration(0);
                    onRecordingStop && onRecordingStop(uri);
                } else {
                    console.warn("❌ Failed to stop recording or get URI");
                }
            }
        } catch (error) {
            console.error("💥 Recording error in handleRecordPress:", error);
            console.error("💥 Error details:", {
                message: error.message,
                stack: error.stack,
                name: error.name,
                isRecording,
                isPaused,
            });
            Alert.alert(
                "Recording Error",
                "Failed to start/stop recording. Please check permissions and try again.",
                [{ text: "OK" }]
            );
        }
    };

    const handlePausePress = async () => {
        console.log("⏸️ RecordingControls: handlePausePress called", {
            disabled,
            isRecording,
            isPaused,
            platform: Platform.OS,
        });

        if (disabled || !isRecording) {
            console.log("❌ Cannot pause: disabled or not recording", {
                disabled,
                isRecording,
            });
            return;
        }

        try {
            if (Platform.OS === "ios") {
                if (!isPaused) {
                    console.log("⏸️ Pausing recording on iOS...");
                    const success = await AudioService.pauseRecording();
                    console.log("⏸️ Pause result:", success);

                    if (success) {
                        console.log("✅ Recording paused, updating UI...");
                        setIsPaused(true);
                        onRecordingPause && onRecordingPause();
                    } else {
                        console.warn("❌ Failed to pause recording");
                    }
                } else {
                    console.log("▶️ Resuming recording on iOS...");
                    const success = await AudioService.resumeRecording();
                    console.log("▶️ Resume result:", success);

                    if (success) {
                        console.log("✅ Recording resumed, updating UI...");
                        setIsPaused(false);
                        onRecordingResume && onRecordingResume();
                    } else {
                        console.warn("❌ Failed to resume recording");
                    }
                }
            } else {
                console.log("⚠️ Android pause not supported, showing alert");
                // Android doesn't support pause, show info
                Alert.alert(
                    "Pause Not Available",
                    "Pause/Resume is not supported on Android. You can stop and start a new recording.",
                    [{ text: "OK" }]
                );
            }
        } catch (error) {
            console.error("Pause error:", error);
        }
    };

    const handleAIToggle = () => {
        onAIAssistToggle && onAIAssistToggle(!isAIEnabled);
    };

    const getRecordButtonColor = () => {
        if (disabled) return "#666666";
        if (isRecording) return "#EF4444"; // red for stop
        return "#D32F2F"; // primary for record
    };

    const getRecordButtonIcon = () => {
        if (isRecording) return "stop";
        return "microphone";
    };

    const getRecordButtonLabel = () => {
        if (isRecording) return "Stop Recording";
        return "Start Recording";
    };

    return (
        <View className="items-center">
            {/* Duration Display */}
            {isRecording && (
                <View className="mb-4 bg-panel px-4 py-2 rounded-lg">
                    <Text className="text-text-primary text-lg font-mono text-center">
                        {formatDuration(duration)}
                    </Text>
                    {isPaused && (
                        <Text className="text-warning text-sm text-center mt-1">
                            PAUSED
                        </Text>
                    )}
                </View>
            )}

            {/* Wave Animation (when recording) */}
            {isRecording && !isPaused && (
                <Animated.View
                    className="absolute top-20"
                    style={{
                        opacity: waveAnimation,
                        transform: [
                            {
                                scaleX: waveAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 1.5],
                                }),
                            },
                        ],
                    }}
                >
                    <View className="flex-row items-center space-x-2">
                        {[1, 2, 3, 4, 5].map((_, index) => (
                            <View
                                key={index}
                                className="w-1 bg-primary"
                                style={{
                                    height: 20 + Math.random() * 30,
                                    opacity: 0.6,
                                }}
                            />
                        ))}
                    </View>
                </Animated.View>
            )}

            {/* Main Controls */}
            <View className="flex-row items-center justify-center space-x-8 mb-6">
                {/* AI Assist Toggle */}
                <TouchableOpacity
                    onPress={handleAIToggle}
                    className={`p-4 rounded-full ${
                        isAIEnabled ? "bg-primary" : "bg-panel"
                    }`}
                    disabled={disabled}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`AI assistance ${
                        isAIEnabled ? "enabled" : "disabled"
                    }`}
                    accessibilityHint="Toggle AI-powered recording assistance"
                >
                    <MaterialCommunityIcons
                        name="robot"
                        size={24}
                        color={isAIEnabled ? "white" : "#888888"}
                    />
                </TouchableOpacity>

                {/* Main Record Button */}
                <Animated.View
                    style={{
                        transform: [{ scale: recordingAnimation }],
                        // Cross-platform shadow
                        ...(Platform.OS === "ios"
                            ? {
                                  shadowColor: "#000",
                                  shadowOffset: { width: 0, height: 4 },
                                  shadowOpacity: 0.3,
                                  shadowRadius: 8,
                              }
                            : {
                                  elevation: 8,
                              }),
                    }}
                >
                    <TouchableOpacity
                        onPress={handleRecordPress}
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: getRecordButtonColor(),
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 4,
                            borderColor: isRecording
                                ? "#FFFFFF"
                                : "transparent",
                        }}
                        disabled={disabled}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={getRecordButtonLabel()}
                        accessibilityHint={
                            isRecording
                                ? "Tap to stop recording"
                                : "Tap to start recording"
                        }
                        activeOpacity={0.8}
                    >
                        <MaterialCommunityIcons
                            name={getRecordButtonIcon()}
                            size={36}
                            color="white"
                        />
                    </TouchableOpacity>
                </Animated.View>

                {/* Pause/Resume Button (iOS only) */}
                {Platform.OS === "ios" && (
                    <TouchableOpacity
                        onPress={handlePausePress}
                        className={`p-4 rounded-full ${
                            isRecording ? "bg-panel" : "bg-panel opacity-50"
                        }`}
                        disabled={disabled || !isRecording}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={
                            isPaused ? "Resume recording" : "Pause recording"
                        }
                        accessibilityHint="Pause or resume current recording"
                    >
                        <Ionicons
                            name={isPaused ? "play" : "pause"}
                            size={24}
                            color={isRecording ? "#FFFFFF" : "#888888"}
                        />
                    </TouchableOpacity>
                )}
            </View>

            {/* Recording Status */}
            <View className="items-center">
                {isRecording ? (
                    <Text className="text-text-secondary text-sm text-center">
                        {isPaused
                            ? "Recording Paused"
                            : "Recording in Progress..."}
                        {isAIEnabled && "\n🤖 AI Enhancement Active"}
                    </Text>
                ) : (
                    <Text className="text-text-secondary text-sm text-center">
                        Tap the record button to start
                        {isAIEnabled && "\n🤖 AI assistance ready"}
                    </Text>
                )}
            </View>
        </View>
    );
};

export default RecordingControls;
