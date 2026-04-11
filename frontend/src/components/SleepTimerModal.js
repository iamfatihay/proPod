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
 * SleepTimerModal
 *
 * Allows the user to set a sleep timer so audio stops automatically after a
 * chosen number of minutes, or stops automatically when the current episode ends.
 *
 * Modes:
 *  - Time-based: presets 5/10/15/30/45/60 min → countdown then pause
 *  - Episode-end: stops when the current episode finishes (no countdown)
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
    const setSleepOnEpisodeEnd = useAudioStore(
        (state) => state.setSleepOnEpisodeEnd
    );
    const sleepTimerActive = useAudioStore((state) => state.sleepTimerActive);
    const sleepTimerRemaining = useAudioStore(
        (state) => state.sleepTimerRemaining
    );
    const sleepOnEpisodeEnd = useAudioStore(
        (state) => state.sleepOnEpisodeEnd
    );

    // Any sleep mode active (time-based OR episode-end)
    const anyActive = sleepTimerActive || sleepOnEpisodeEnd;

    const handlePreset = (minutes) => {
        setSleepTimer(minutes);
        onClose();
    };

    const handleEpisodeEnd = () => {
        setSleepOnEpisodeEnd(true);
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
                <View style={styles.sheet}>
                    {/* Header */}
                    <View style={styles.header}>
                        <MaterialCommunityIcons
                            name="moon-waning-crescent"
                            size={20}
                            color={COLORS.primary}
                        />
                        <Text style={styles.title}>Sleep Timer</Text>
                    </View>

                    {/* Active countdown — time-based */}
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

                    {/* Active indicator — episode-end mode */}
                    {sleepOnEpisodeEnd && (
                        <View style={styles.countdownBox}>
                            <MaterialCommunityIcons
                                name="skip-next-circle-outline"
                                size={28}
                                color={COLORS.primary}
                                style={{ marginBottom: 4 }}
                            />
                            <Text style={styles.countdownLabel}>
                                Pausing after this episode
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

                    {/* End-of-episode option */}
                    <TouchableOpacity
                        style={[
                            styles.episodeEndButton,
                            sleepOnEpisodeEnd && styles.episodeEndButtonActive,
                        ]}
                        onPress={handleEpisodeEnd}
                        accessible
                        accessibilityRole="button"
                        accessibilityLabel="Stop after this episode ends"
                    >
                        <MaterialCommunityIcons
                            name="skip-next-circle-outline"
                            size={18}
                            color={
                                sleepOnEpisodeEnd
                                    ? "#fff"
                                    : COLORS.text.primary
                            }
                        />
                        <Text
                            style={[
                                styles.episodeEndText,
                                sleepOnEpisodeEnd &&
                                    styles.episodeEndTextActive,
                            ]}
                        >
                            End of episode
                        </Text>
                    </TouchableOpacity>

                    {/* Cancel / Close buttons */}
                    <View style={styles.footer}>
                        {anyActive ? (
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
                </View>
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
        marginBottom: 16,
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
    episodeEndButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: COLORS.card,
        borderRadius: 12,
        paddingVertical: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    episodeEndButtonActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    episodeEndText: {
        color: COLORS.text.primary,
        fontSize: 15,
        fontWeight: "600",
    },
    episodeEndTextActive: {
        color: "#fff",
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
