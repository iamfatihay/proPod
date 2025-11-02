import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";

/**
 * Skeleton Loader component for loading states
 * Provides a shimmering effect for better perceived performance
 */
const SkeletonLoader = ({
    width = "100%",
    height = 20,
    borderRadius = 8,
    style = {},
}) => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();

        return () => animation.stop();
    }, []);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View
            style={[
                styles.skeleton,
                {
                    width,
                    height,
                    borderRadius,
                    opacity,
                },
                style,
            ]}
        />
    );
};

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: "#333333",
    },
});

/**
 * PodcastCardSkeleton - Skeleton for PodcastCard component
 */
export const PodcastCardSkeleton = () => (
    <View
        style={{
            backgroundColor: "#232323",
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
        }}
    >
        {/* Thumbnail */}
        <SkeletonLoader
            width={56}
            height={56}
            borderRadius={12}
            style={{ marginRight: 16 }}
        />

        {/* Content */}
        <View style={{ flex: 1 }}>
            <SkeletonLoader
                width="80%"
                height={16}
                borderRadius={4}
                style={{ marginBottom: 8 }}
            />
            <SkeletonLoader
                width="60%"
                height={14}
                borderRadius={4}
                style={{ marginBottom: 6 }}
            />
            <SkeletonLoader width="40%" height={12} borderRadius={4} />
        </View>

        {/* Play button */}
        <SkeletonLoader width={40} height={40} borderRadius={20} />
    </View>
);

/**
 * CategoryFilterSkeleton - Skeleton for category filter chips
 */
export const CategoryFilterSkeleton = () => (
    <View style={{ flexDirection: "row", marginBottom: 24, paddingRight: 16 }}>
        {[1, 2, 3, 4, 5].map((index) => (
            <SkeletonLoader
                key={index}
                width={100}
                height={36}
                borderRadius={18}
                style={{ marginRight: 12 }}
            />
        ))}
    </View>
);

export default SkeletonLoader;
