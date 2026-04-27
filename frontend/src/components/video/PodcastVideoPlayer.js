import React from "react";
import { View, Text } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

const configurePodcastPlayer = (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.audioMixingMode = "auto";
    videoPlayer.showNowPlayingNotification = false;
};

const PodcastVideoPlayer = ({ uri, title, subtitle }) => {
    const player = useVideoPlayer(uri, configurePodcastPlayer);

    if (!uri) {
        return null;
    }

    return (
        <View className="px-6 mb-6">
            <View className="flex-row items-center mb-3">
                <MaterialCommunityIcons
                    name="video-box"
                    size={20}
                    color={COLORS.primary}
                />
                <Text className="text-text-primary text-lg font-semibold ml-2">
                    Video Episode
                </Text>
            </View>

            <View className="bg-panel rounded-2xl overflow-hidden border border-border">
                <VideoView
                    player={player}
                    style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" }}
                    nativeControls
                    allowsPictureInPicture
                    contentFit="contain"
                    surfaceType="textureView"
                    fullscreenOptions={{ enable: true }}
                />
            </View>

            <Text className="text-text-primary font-semibold mt-3">{title}</Text>
            <Text className="text-text-secondary mt-1">
                {subtitle || "Recorded in video mode"}
            </Text>
            <Text className="text-text-secondary text-sm mt-2 leading-5">
                Watch inline here or expand to fullscreen using the native player controls.
            </Text>
        </View>
    );
};

export default PodcastVideoPlayer;