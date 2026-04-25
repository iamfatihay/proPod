import React from "react";
import { View, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, addAlpha } from "../constants/theme";

/**
 * PlaylistMosaic
 *
 * Renders a 44×44 2×2 grid of cover-art thumbnails when the playlist has
 * episode artwork, otherwise falls back to a themed icon bubble.
 *
 * Props:
 *   thumbnails  {string[]}  Up to 4 URLs from `preview_thumbnails` (backend field).
 *   isPublic    {boolean}   Selects the icon shown in the fallback bubble.
 *   size        {number}    Optional tile size override (default 44). Each quadrant
 *                           is size/2.
 */
const PlaylistMosaic = ({ thumbnails, isPublic, size = 44 }) => {
    const half = size / 2;
    const urls = (thumbnails || []).filter(Boolean).slice(0, 4);

    if (urls.length === 0) {
        return (
            <View
                style={{
                    width: size,
                    height: size,
                    borderRadius: 12,
                    backgroundColor: addAlpha(COLORS.primary, 0.1),
                    borderWidth: 1,
                    borderColor: addAlpha(COLORS.primary, 0.2),
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <MaterialCommunityIcons
                    name={isPublic ? "playlist-music" : "playlist-lock"}
                    size={size * 0.5}
                    color={COLORS.primary}
                />
            </View>
        );
    }

    // Pad to 4 slots so the 2×2 grid stays stable with 1–3 images
    const slots = [...urls, ...Array(4 - urls.length).fill(null)];

    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: 12,
                overflow: "hidden",
                flexDirection: "row",
                flexWrap: "wrap",
            }}
        >
            {slots.map((url, i) =>
                url ? (
                    <Image
                        key={i}
                        source={{ uri: url }}
                        style={{ width: half, height: half }}
                        resizeMode="cover"
                    />
                ) : (
                    <View
                        key={i}
                        style={{
                            width: half,
                            height: half,
                            backgroundColor: addAlpha(COLORS.primary, 0.1),
                        }}
                    />
                )
            )}
        </View>
    );
};

export default PlaylistMosaic;
