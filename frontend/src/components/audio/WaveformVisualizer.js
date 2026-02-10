import React, { useEffect, useRef, useState } from "react";
import { View, Animated, StyleSheet, Dimensions } from "react-native";
import Logger from "../../utils/logger";

const { width: screenWidth } = Dimensions.get("window");

/**
 * Enhanced Waveform Visualizer Component
 *
 * Creates a real-time audio waveform visualization using animated bars.
 * Can work with real audio data or fallback to animated visualization.
 *
 * Features:
 * - Real audio data integration (when available)
 * - Smooth animations using React Native Animated API
 * - Responsive design that adapts to container size
 * - Customizable colors and bar count
 * - Performance optimized with minimal re-renders
 * - Fallback to animated mode when no audio data available
 */
const WaveformVisualizer = ({
    isActive = false,
    audioData = null, // Real audio data array (optional)
    barCount = 30,
    barColor = "#D32F2F",
    minHeight = 4,
    maxHeight = 40,
    barWidth = 3,
    barGap = 2,
    containerStyle = {},
    useRealData = false, // Flag to enable real data processing
}) => {
    const animatedValues = useRef(
        Array.from({ length: barCount }, () => new Animated.Value(minHeight))
    ).current;

    const [animations, setAnimations] = useState([]);
    const [processedAudioData, setProcessedAudioData] = useState(null);

    // Process real audio data if available
    useEffect(() => {
        if (audioData && useRealData) {
            processAudioData(audioData);
        }
    }, [audioData, useRealData, barCount]);

    const processAudioData = (data) => {
        try {
            // Convert audio data to waveform heights
            // This is a simplified version - in a real implementation,
            // you'd use FFT or other audio analysis techniques
            const chunkSize = Math.floor(data.length / barCount);
            const processedData = [];

            for (let i = 0; i < barCount; i++) {
                const start = i * chunkSize;
                const end = start + chunkSize;
                const chunk = data.slice(start, end);

                // Calculate RMS (Root Mean Square) for amplitude
                const rms = Math.sqrt(
                    chunk.reduce((sum, val) => sum + val * val, 0) /
                        chunk.length
                );

                // Normalize to our height range
                const normalizedHeight =
                    minHeight + rms * (maxHeight - minHeight);
                processedData.push(normalizedHeight);
            }

            setProcessedAudioData(processedData);
        } catch (error) {
            Logger.error("Failed to process audio data:", error);
            setProcessedAudioData(null);
        }
    };

    useEffect(() => {
        if (isActive) {
            if (processedAudioData && useRealData) {
                // Use real audio data for visualization
                processedAudioData.forEach((height, index) => {
                    Animated.timing(animatedValues[index], {
                        toValue: height,
                        duration: 100,
                        useNativeDriver: false,
                    }).start();
                });
            } else {
                // Fallback to animated visualization
                const newAnimations = animatedValues.map((animValue, index) => {
                    // Create wave effect with different delays and durations
                    const delay = (index * 50) % 400;
                    const duration = 300 + (index % 5) * 100;

                    return Animated.loop(
                        Animated.sequence([
                            Animated.timing(animValue, {
                                toValue: maxHeight,
                                duration: duration,
                                delay: delay,
                                useNativeDriver: false,
                            }),
                            Animated.timing(animValue, {
                                toValue: minHeight,
                                duration: duration,
                                useNativeDriver: false,
                            }),
                        ])
                    );
                });

                setAnimations(newAnimations);

                // Start all animations
                newAnimations.forEach((anim) => anim.start());
            }
        } else {
            // Stop animations and reset to min height
            animations.forEach((anim) => anim.stop());
            animatedValues.forEach((animValue) => {
                Animated.timing(animValue, {
                    toValue: minHeight,
                    duration: 200,
                    useNativeDriver: false,
                }).start();
            });
        }

        return () => {
            animations.forEach((anim) => anim.stop());
        };
    }, [isActive, processedAudioData, useRealData]);

    return (
        <View style={[styles.container, containerStyle]}>
            <View style={styles.waveformContainer}>
                {animatedValues.map((animValue, index) => (
                    <Animated.View
                        key={index}
                        style={[
                            styles.bar,
                            {
                                height: animValue,
                                backgroundColor: barColor,
                                width: barWidth,
                                marginHorizontal: barGap / 2,
                            },
                        ]}
                    />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 50,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
    waveformContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
    },
    bar: {
        borderRadius: 2,
    },
});

export default WaveformVisualizer;
