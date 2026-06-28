/**
 * MultitrackPlayer
 *
 * Plays back the per-speaker recording tracks captured for a multi-host RTC
 * session (100ms `track.recording.success` webhooks → session.track_recordings),
 * plus the combined mix. Lets the user switch between each speaker's isolated
 * track and the combined recording — the foundation of the multitrack export
 * experience.
 *
 * Tracks are populated asynchronously by the recording webhook, so this renders
 * nothing until at least one source is available.
 */
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { toAbsoluteUrl } from "../../utils/urlHelper";
import { COLORS } from "../../constants/theme";

const formatTime = (seconds) => {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const mm = String(Math.floor(safe / 60)).padStart(2, "0");
    const ss = String(safe % 60).padStart(2, "0");
    return `${mm}:${ss}`;
};

const buildSources = (tracks, combined) => {
    const sources = [];

    if (combined?.url) {
        sources.push({
            key: "combined",
            label: combined.label || "Combined",
            sublabel: null,
            icon: "account-multiple",
            uri: toAbsoluteUrl(combined.url),
        });
    }

    (tracks || []).forEach((track, index) => {
        if (!track?.url) return;
        sources.push({
            key: `${track.peer_id || "peer"}-${track.track_type || "audio"}-${index}`,
            label: track.display_name || `Speaker ${index + 1}`,
            sublabel: track.track_type === "video" ? "Video" : "Audio",
            icon: track.role === "host" ? "star" : "account",
            uri: toAbsoluteUrl(track.url),
        });
    });

    return sources;
};

const MultitrackPlayer = ({ tracks, combined }) => {
    const sources = useMemo(() => buildSources(tracks, combined), [tracks, combined]);
    const [activeIndex, setActiveIndex] = useState(0);
    const active = sources[activeIndex] || sources[0];

    // Hooks must run unconditionally; an empty source yields an idle player.
    const player = useAudioPlayer(active ? { uri: active.uri } : null);
    const status = useAudioPlayerStatus(player);

    // Load the selected source and reset playback whenever the tab changes.
    useEffect(() => {
        if (!player || !active?.uri) return;
        try {
            player.replace({ uri: active.uri });
            player.pause();
            player.seekTo(0);
        } catch {
            // Player may not be ready yet; the next interaction will retry.
        }
    }, [active?.uri, player]);

    if (sources.length === 0) {
        return null;
    }

    const isPlaying = Boolean(status?.playing);
    const current = status?.currentTime || 0;
    const total = status?.duration || 0;
    const progress = total > 0 ? Math.min(1, current / total) : 0;

    const togglePlay = () => {
        if (!player) return;
        if (isPlaying) {
            player.pause();
        } else {
            player.play();
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <MaterialCommunityIcons name="waveform" size={16} color={COLORS.primary} />
                <Text style={styles.headerText}>Recording tracks</Text>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabs}
            >
                {sources.map((source, index) => {
                    const isActive = index === activeIndex;
                    return (
                        <TouchableOpacity
                            key={source.key}
                            onPress={() => setActiveIndex(index)}
                            style={[styles.tab, isActive && styles.tabActive]}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons
                                name={source.icon}
                                size={14}
                                color={isActive ? COLORS.primary : COLORS.text.muted}
                            />
                            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
                                {source.label}
                            </Text>
                            {source.sublabel ? (
                                <Text style={styles.tabSublabel}>{source.sublabel}</Text>
                            ) : null}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <View style={styles.controls}>
                <TouchableOpacity onPress={togglePlay} style={styles.playButton} activeOpacity={0.8}>
                    <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="#fff" />
                </TouchableOpacity>

                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>

                <Text style={styles.time}>
                    {formatTime(current)} / {formatTime(total)}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 12,
        padding: 12,
        borderRadius: 14,
        backgroundColor: COLORS.panel || "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: COLORS.border || "rgba(255,255,255,0.08)",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
    },
    headerText: {
        color: COLORS.text.primary,
        fontWeight: "600",
        marginLeft: 6,
        fontSize: 13,
    },
    tabs: {
        gap: 8,
        paddingBottom: 4,
    },
    tab: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "transparent",
    },
    tabActive: {
        borderColor: COLORS.primary,
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    tabLabel: {
        color: COLORS.text.muted,
        marginLeft: 6,
        fontSize: 12,
        maxWidth: 110,
    },
    tabLabelActive: {
        color: COLORS.text.primary,
        fontWeight: "600",
    },
    tabSublabel: {
        color: COLORS.text.muted,
        marginLeft: 6,
        fontSize: 10,
        textTransform: "uppercase",
    },
    controls: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 12,
    },
    playButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    progressTrack: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.12)",
        marginHorizontal: 12,
        overflow: "hidden",
    },
    progressFill: {
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.primary,
    },
    time: {
        color: COLORS.text.secondary,
        fontSize: 12,
        fontVariant: ["tabular-nums"],
        minWidth: 86,
        textAlign: "right",
    },
});

export default MultitrackPlayer;
