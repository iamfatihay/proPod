import React, { useEffect, useState } from "react";
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
 * SleepTimerModal
 *
 * Allows the user to set a sleep timer so audio stops automatically after a
 * chosen number of minutes.  Shows a live countdown when a timer is active.
 *
 * Usage:
 *   <SleepTimerModal visible={show} onClose={() => setShow(false)} />
 */

const PRESETS = [5, 10, 15, 30, 45, 60]; // minutes

const formatCountdown = (ms) => {
    if (ms <= 0) return "0:00";
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const SleepTimerModal = ({ visible, onClose }) => {
    const setSleepTimer = useAudioStore((state) => state.setSleepTimer);
    const cancelSleepTimer = useAudioStore((state) => state.cancelSleepTimer);
    const sleepTimerActive = useAudioStore((state) => state.sleepTimerActive);
    const sleepTimerRemaining = useAudioStore(
        (state) => state.sleepTimerRemaining
    );

    const handlePreset = (minutes) => {
        setSleepTimer(minutes);
        onClose();
    };

    const handleCancel = () => {
        cancelSleepTimer();
        onClose();
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
                            name="moon-waning-crescent"
                            size={20}
                            color={COLORS.primary}
                        />
                        <Text style={styles.title}>Sleep Timer</Text>
                    </View>

                    {/* Active countdown */}
                    {sleepTimerActive && (
                        <View style={styles.countdownBox}>
                            <Text style={styles.countdownLabel}>
                                Pausing in
                            </Text>
                            <Text style={styles.countdown}>
                                {formatCountdown(sleepTimerRemaining)}
                            </Text>
                        </View>
                    )}

                    {/* Preset grid */}
                    <View style={styles.grid}>
                        {PRESETS.map((minutes) => (
                            <TouchableOpacity
                                key={minutes}
                                style={styles.presetButton}
                                onPress={() => handlePreset(minutes)}
                                accessible
                                accessibilityRole="button"
                                accessibilityLabel={`Set sleep timer to ${minutes} minutes`}
                            >
                                <Text style={styles.presetText}>
                                    {minutes}
                                </Text>
                                <Text style={styles.presetUnit}>min</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Cancel / Close buttons */}
                    <View style={styles.footer}>
                        {sleepTimerActive ? (
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={handleCancel}
                                accessible
                                accessibilityRole="button"
                                accessibilityLabel="Cancel sleep timer"
                            >
                                <MaterialCommunityIcons
                                    name="timer-off"
                                    size={16}
                                    color={COLORS.primary}
                                />
                                <Text style={styles.cancelText}>
                                    Cancel Timer
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.dismissButton}
                                onPress={onClose}
                                accessible
                                accessibilityRole="button"
                                accessibilityLabel="Dismiss"
                            >
                                <Text style={styles.dismissText}>Dismiss</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.65)",
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: COLORS.panel,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 36,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 20,
    },
    title: {
        color: COLORS.text.primary,
        fontSize: 17,
        fontWeight: "600",
    },
    countdownBox: {
        alignItems: "center",
        backgroundColor: COLORS.card,
        borderRadius: 12,
        paddingVertical: 12,
        marginBottom: 20,
    },
    countdownLabel: {
        color: COLORS.text.muted,
        fontSize: 12,
        marginBottom: 4,
    },
    countdown: {
        color: COLORS.primary,
        fontSize: 32,
        fontWeight: "700",
        letterSpacing: 1,
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 20,
    },
    presetButton: {
        flex: 1,
        minWidth: "28%",
        backgroundColor: COLORS.card,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    presetText: {
        color: COLORS.text.primary,
        fontSize: 20,
        fontWeight: "700",
    },
    presetUnit: {
        color: COLORS.text.muted,
        fontSize: 12,
        marginTop: 2,
    },
    footer: {
        alignItems: "center",
    },
    cancelButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    cancelText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: "600",
    },
    dismissButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    dismissText: {
        color: COLORS.text.muted,
        fontSize: 14,
    },
});

export default SleepTimerModal;
