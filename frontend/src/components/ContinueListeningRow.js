import React from "react";
import {
    View,
    Text,
    Image,
    ScrollView,
    TouchableOpacity,
    Platform,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { COLORS, BORDER_RADIUS } from "../constants/theme";

/**
 * ContinueListeningRow
 *
 * A horizontal scrolling row of cards showing podcasts the user has started
 * but not yet finished. Each card shows:
 *   - Thumbnail (or a fallback icon)
 *   - Episode title (truncated to 2 lines)
 *   - Owner / creator name
 *   - Progress bar reflecting progress_percent
 *   - Remaining time label
 *   - Resume play / pause button
 *
 * Props:
 *   items          {Array}    Array of ContinueListeningItem from backend
 *   currentTrackId {number}   ID of the currently loaded track (from audio store)
 *   isPlaying      {boolean}  Whether audio is currently playing
 *   onResume       {Function} (item) => void  — called when user taps Resume
 *   onCardPress    {Function} (item) => void  — called when user taps the card body
 */

/** Format a duration in seconds as "Xm left" or "Xh Xm left". */
function formatTimeLeft(totalSeconds, progressPercent) {
    const remaining = totalSeconds * (1 - progressPercent / 100);
    if (remaining <= 0) return null;
    const minutes = Math.round(remaining / 60);
    if (minutes < 60) return `${minutes}m left`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
}

const CARD_WIDTH = 160;
const CARD_HEIGHT = 220;
const THUMBNAIL_SIZE = CARD_WIDTH;
const THUMBNAIL_HEIGHT = 100;

export default function ContinueListeningRow({
    items = [],
    currentTrackId,
    isPlaying,
    onResume,
    onCardPress,
}) {
    if (!items || items.length === 0) return null;

    return (
        <View style={{ marginBottom: 24 }}>
            {/* Section header */}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                    paddingHorizontal: 0,
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <MaterialCommunityIcons
                        name="headphones"
                        size={22}
                        color={COLORS.primary}
                    />
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: "700",
                            color: COLORS.text.primary,
                            marginLeft: 8,
                        }}
                    >
                        Continue Listening
                    </Text>
                </View>
                <Text
                    style={{
                        fontSize: 12,
                        color: COLORS.text.muted,
                    }}
                >
                    {items.length} {items.length === 1 ? "episode" : "episodes"}
                </Text>
            </View>

            {/* Horizontal scroll of cards */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 16 }}
            >
                {items.map((item) => {
                    const isActive = currentTrackId === item.podcast_id;
                    const timeLeft = formatTimeLeft(
                        item.duration,
                        item.progress_percent
                    );

                    return (
                        <TouchableOpacity
                            key={item.podcast_id}
                            activeOpacity={0.85}
                            onPress={() => onCardPress && onCardPress(item)}
                            style={{
                                width: CARD_WIDTH,
                                height: CARD_HEIGHT,
                                backgroundColor: COLORS.card,
                                borderRadius: BORDER_RADIUS.xl,
                                marginRight: 12,
                                overflow: "hidden",
                                ...(Platform.OS === "ios"
                                    ? {
                                          shadowColor: COLORS.primary,
                                          shadowOffset: { width: 0, height: 4 },
                                          shadowOpacity: isActive ? 0.4 : 0.15,
                                          shadowRadius: 8,
                                      }
                                    : {
                                          elevation: isActive ? 8 : 3,
                                      }),
                                borderWidth: isActive ? 1.5 : 0,
                                borderColor: isActive
                                    ? COLORS.primary
                                    : "transparent",
                            }}
                        >
                            {/* Thumbnail */}
                            <View
                                style={{
                                    width: THUMBNAIL_SIZE,
                                    height: THUMBNAIL_HEIGHT,
                                    backgroundColor: COLORS.panel,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {item.thumbnail_url ? (
                                    <Image
                                        source={{ uri: item.thumbnail_url }}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                        }}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <MaterialCommunityIcons
                                        name="podcast"
                                        size={40}
                                        color={COLORS.text.muted}
                                    />
                                )}

                                {/* Playing indicator overlay */}
                                {isActive && isPlaying && (
                                    <View
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            backgroundColor:
                                                "rgba(0,0,0,0.45)",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <MaterialCommunityIcons
                                            name="equalizer"
                                            size={32}
                                            color={COLORS.primary}
                                        />
                                    </View>
                                )}
                            </View>

                            {/* Card body */}
                            <View
                                style={{
                                    flex: 1,
                                    padding: 10,
                                    justifyContent: "space-between",
                                }}
                            >
                                {/* Title + creator */}
                                <View>
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            fontWeight: "600",
                                            color: COLORS.text.primary,
                                            lineHeight: 18,
                                        }}
                                        numberOfLines={2}
                                    >
                                        {item.title}
                                    </Text>
                                    {item.owner_name && (
                                        <Text
                                            style={{
                                                fontSize: 11,
                                                color: COLORS.text.muted,
                                                marginTop: 2,
                                            }}
                                            numberOfLines={1}
                                        >
                                            {item.owner_name}
                                        </Text>
                                    )}
                                </View>

                                {/* Progress bar */}
                                <View>
                                    <View
                                        style={{
                                            height: 3,
                                            backgroundColor: COLORS.panel,
                                            borderRadius: 2,
                                            marginBottom: 4,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <View
                                            style={{
                                                height: "100%",
                                                width: `${Math.min(
                                                    item.progress_percent,
                                                    100
                                                )}%`,
                                                backgroundColor: COLORS.primary,
                                                borderRadius: 2,
                                            }}
                                        />
                                    </View>

                                    {/* Time left + resume button */}
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 10,
                                                color: COLORS.text.muted,
                                            }}
                                        >
                                            {timeLeft ||
                                                `${Math.round(
                                                    item.progress_percent
                                                )}%`}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() =>
                                                onResume && onResume(item)
                                            }
                                            hitSlop={{
                                                top: 8,
                                                bottom: 8,
                                                left: 8,
                                                right: 8,
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <MaterialCommunityIcons
                                                name={
                                                    isActive && isPlaying
                                                        ? "pause-circle"
                                                        : "play-circle"
                                                }
                                                size={32}
                                                color={COLORS.primary}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}
