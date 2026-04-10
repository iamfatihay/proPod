import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    StyleSheet,
    Pressable,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import useAudioStore from "../context/useAudioStore";
import { COLORS } from "../constants/theme";

/**
 * PlaybackSpeedModal
 *
 * Allows the user to select playback speed for the current audio.
 * Preset speeds: 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 2.0x
 *
 * Usage:
 *   <PlaybackSpeedModal visible={show} onClose={() => setShow(false)} />
 */

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const PlaybackSpeedModal = ({ visible, onClose }) => {
    const playbackRate = useAudioStore((state) => state.playbackRate);
    const setPlaybackRate = useAudioStore((state) => state.setPlaybackRate);

    const handleSpeedSelect = (speed) => {
        setPlaybackRate(speed);
        onClose();
    };

    const formatSpeed = (speed) => {
        // Display as "Normal" for 1.0, otherwise show decimal
        if (speed === 1.0) return "Normal";
        return `${speed.toFixed(2)}x`;
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={() => {}}>
                    {/* Header */}
                    <View style={styles.header}>
                        <MaterialCommunityIcons
                            name="speedometer"
                            size={20}
                            color={COLORS.primary}
                        />
                        <Text style={styles.title}>Playback Speed</Text>
                    </View>

                    {/* Current speed display */}
                    <View style={styles.currentSpeedBox}>
                        <Text style={styles.currentSpeedLabel}>
                            Current Speed
                        </Text>
                        <Text style={styles.currentSpeed}>
                            {formatSpeed(playbackRate)}
                        </Text>
                    </View>

                    {/* Speed preset grid */}
                    <View style={styles.grid}>
                        {SPEED_PRESETS.map((speed) => {
                            const isSelected = Math.abs(playbackRate - speed) < 0.01;
                            return (
                                <TouchableOpacity
                                    key={speed}
                                    style={[
                                        styles.speedButton,
                                        isSelected && styles.speedButtonActive,
                                    ]}
                                    onPress={() => handleSpeedSelect(speed)}
                                    accessible
                                    accessibilityRole="button"
                                    accessibilityLabel={`Set playback speed to ${formatSpeed(speed)}`}
                                    accessibilityState={{
                                        selected: isSelected,
                                    }}
                                >
                                    {isSelected && (
                                        <MaterialCommunityIcons
                                            name="check-circle"
                                            size={16}
                                            color={COLORS.white}
                                            style={styles.checkmark}
                                        />
                                    )}
                                    <Text
                                        style={[
                                            styles.speedText,
                                            isSelected && styles.speedTextActive,
                                        ]}
                                    >
                                        {formatSpeed(speed)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Close button */}
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={onClose}
                        accessible
                        accessibilityRole="button"
                        accessibilityLabel="Close playback speed selector"
                    >
                        <Text style={styles.closeButtonText}>Done</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 24,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 20,
    },
    title: {
        marginLeft: 12,
        fontSize: 18,
        fontWeight: "600",
        color: COLORS.text,
    },
    currentSpeedBox: {
        backgroundColor: COLORS.background,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginBottom: 20,
        alignItems: "center",
    },
    currentSpeedLabel: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: 8,
    },
    currentSpeed: {
        fontSize: 24,
        fontWeight: "700",
        color: COLORS.primary,
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginHorizontal: -6,
        marginBottom: 20,
    },
    speedButton: {
        width: "33.33%",
        paddingHorizontal: 6,
        marginBottom: 12,
        backgroundColor: COLORS.background,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    speedButtonActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    checkmark: {
        marginBottom: 4,
    },
    speedText: {
        fontSize: 14,
        fontWeight: "600",
        color: COLORS.text,
    },
    speedTextActive: {
        color: COLORS.white,
    },
    closeButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
    },
    closeButtonText: {
        fontSize: 16,
        fontWeight: "600",
        color: COLORS.white,
    },
});

export default PlaybackSpeedModal;
