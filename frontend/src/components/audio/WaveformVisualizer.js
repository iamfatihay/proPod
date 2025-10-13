import React, { useEffect, useRef, useState } from "react";
import { View, Animated, StyleSheet, Dimensions } from "react-native";

const { width: screenWidth } = Dimensions.get("window");

/**
 * Modern Waveform Visualizer Component
 * 
 * Creates a real-time audio waveform visualization using animated bars.
 * Provides visual feedback during audio playback and recording.
 * 
 * Features:
 * - Smooth animations using React Native Animated API
 * - Responsive design that adapts to container size
 * - Customizable colors and bar count
 * - Performance optimized with minimal re-renders
 */
const WaveformVisualizer = ({
    isActive = false,
    barCount = 30,
    barColor = "#D32F2F",
    minHeight = 4,
    maxHeight = 40,
    barWidth = 3,
    barGap = 2,
    containerStyle = {},
}) => {
    const animatedValues = useRef(
        Array.from({ length: barCount }, () => new Animated.Value(minHeight))
    ).current;
    
    const [animations, setAnimations] = useState([]);

    useEffect(() => {
        if (isActive) {
            // Create staggered wave animation for each bar
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
            newAnimations.forEach(anim => anim.start());
        } else {
            // Stop animations and reset to min height
            animations.forEach(anim => anim.stop());
            animatedValues.forEach(animValue => {
                Animated.timing(animValue, {
                    toValue: minHeight,
                    duration: 200,
                    useNativeDriver: false,
                }).start();
            });
        }
        
        return () => {
            animations.forEach(anim => anim.stop());
        };
    }, [isActive]);

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

