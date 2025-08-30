import React from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Linking,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

const AIProcessingResults = ({
    results,
    isVisible = true,
    onApplyCategory,
    onApplySummary,
}) => {
    if (!isVisible || !results || !results.success) {
        return null;
    }

    const { transcription, analysis, audio_enhancement } = results;

    const renderTranscriptionResults = () => {
        if (!transcription || !transcription.success) return null;

        return (
            <View className="bg-card rounded-lg p-4 mb-4">
                <View className="flex-row items-center mb-3">
                    <MaterialCommunityIcons
                        name="text-to-speech"
                        size={20}
                        color="#10B981" // success color
                    />
                    <Text className="text-text-primary font-semibold ml-2">
                        Transcription
                    </Text>
                    <View className="ml-auto">
                        <Text className="text-xs text-text-secondary">
                            {transcription.language.toUpperCase()}(
                            {(transcription.language_probability * 100).toFixed(
                                0
                            )}
                            %)
                        </Text>
                    </View>
                </View>

                <View className="bg-panel rounded-lg p-3 mb-3">
                    <Text className="text-text-secondary text-sm leading-6">
                        {transcription.text.substring(0, 200)}
                        {transcription.text.length > 200 && "..."}
                    </Text>
                </View>

                <View className="flex-row justify-between">
                    <Text className="text-text-secondary text-xs">
                        Duration: {Math.round(transcription.duration)}s
                    </Text>
                    <Text className="text-text-secondary text-xs">
                        Processing: {transcription.processing_time}s
                    </Text>
                </View>
            </View>
        );
    };

    const renderAnalysisResults = () => {
        if (!analysis || !analysis.success) return null;

        return (
            <View className="bg-card rounded-lg p-4 mb-4">
                <View className="flex-row items-center mb-3">
                    <MaterialCommunityIcons
                        name="brain"
                        size={20}
                        color="#8B5CF6" // purple variant
                    />
                    <Text className="text-text-primary font-semibold ml-2">
                        Content Analysis
                    </Text>
                </View>

                {/* Keywords */}
                {analysis.keywords && analysis.keywords.length > 0 && (
                    <View className="mb-4">
                        <Text className="text-text-primary font-medium mb-2">
                            Keywords
                        </Text>
                        <View className="flex-row flex-wrap">
                            {analysis.keywords
                                .slice(0, 6)
                                .map((keyword, index) => (
                                    <View
                                        key={index}
                                        className="bg-primary/20 rounded-full px-3 py-1 mr-2 mb-2"
                                    >
                                        <Text className="text-primary text-sm">
                                            {keyword.word}
                                        </Text>
                                    </View>
                                ))}
                        </View>
                    </View>
                )}

                {/* Categories */}
                {analysis.categories && analysis.categories.length > 0 && (
                    <View className="mb-4">
                        <View className="flex-row items-center justify-between mb-2">
                            <Text className="text-text-primary font-medium">
                                Suggested Categories
                            </Text>
                            {onApplyCategory && (
                                <TouchableOpacity
                                    onPress={() =>
                                        onApplyCategory(
                                            analysis.categories[0].category
                                        )
                                    }
                                    className="bg-primary rounded-lg px-3 py-1"
                                >
                                    <Text className="text-white text-sm">
                                        Apply
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <View className="space-y-1">
                            {analysis.categories
                                .slice(0, 3)
                                .map((category, index) => (
                                    <View
                                        key={index}
                                        className="flex-row items-center justify-between bg-panel rounded-lg p-2"
                                    >
                                        <Text className="text-text-primary">
                                            {category.category}
                                        </Text>
                                        <View className="flex-row items-center">
                                            <Text className="text-text-secondary text-sm mr-2">
                                                {(
                                                    category.confidence * 100
                                                ).toFixed(0)}
                                                %
                                            </Text>
                                            <View className="w-12 h-2 bg-background rounded-full">
                                                <View
                                                    className="h-2 bg-primary rounded-full"
                                                    style={{
                                                        width: `${
                                                            category.confidence *
                                                            100
                                                        }%`,
                                                    }}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                ))}
                        </View>
                    </View>
                )}

                {/* Summary */}
                {analysis.summary && (
                    <View className="mb-4">
                        <View className="flex-row items-center justify-between mb-2">
                            <Text className="text-text-primary font-medium">
                                AI-Generated Summary
                            </Text>
                            {onApplySummary && (
                                <TouchableOpacity
                                    onPress={() =>
                                        onApplySummary(analysis.summary)
                                    }
                                    className="bg-primary rounded-lg px-3 py-1"
                                >
                                    <Text className="text-white text-sm">
                                        Apply
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <View className="bg-panel rounded-lg p-3">
                            <Text className="text-text-secondary text-sm leading-5">
                                {analysis.summary}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Sentiment */}
                {analysis.sentiment && (
                    <View className="mb-4">
                        <Text className="text-text-primary font-medium mb-2">
                            Sentiment Analysis
                        </Text>
                        <View className="flex-row items-center bg-panel rounded-lg p-3">
                            <View className="flex-row items-center flex-1">
                                <MaterialCommunityIcons
                                    name={
                                        analysis.sentiment.label === "positive"
                                            ? "emoticon-happy"
                                            : analysis.sentiment.label ===
                                              "negative"
                                            ? "emoticon-sad"
                                            : "emoticon-neutral"
                                    }
                                    size={20}
                                    color={
                                        analysis.sentiment.label === "positive"
                                            ? "#10B981"
                                            : analysis.sentiment.label ===
                                              "negative"
                                            ? "#EF4444"
                                            : "#6B7280"
                                    }
                                />
                                <Text className="text-text-primary ml-2 capitalize">
                                    {analysis.sentiment.label}
                                </Text>
                            </View>
                            <Text className="text-text-secondary text-sm">
                                {(analysis.sentiment.confidence * 100).toFixed(
                                    0
                                )}
                                % confidence
                            </Text>
                        </View>
                    </View>
                )}

                {/* Text Stats */}
                {analysis.text_stats && (
                    <View>
                        <Text className="text-text-primary font-medium mb-2">
                            Content Statistics
                        </Text>
                        <View className="grid grid-cols-2 gap-2">
                            <View className="bg-panel rounded-lg p-3">
                                <Text className="text-text-secondary text-xs">
                                    Words
                                </Text>
                                <Text className="text-text-primary font-semibold">
                                    {analysis.text_stats.word_count}
                                </Text>
                            </View>
                            <View className="bg-panel rounded-lg p-3">
                                <Text className="text-text-secondary text-xs">
                                    Reading Time
                                </Text>
                                <Text className="text-text-primary font-semibold">
                                    {analysis.text_stats.reading_time_minutes}m
                                </Text>
                            </View>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const renderAudioResults = () => {
        if (!audio_enhancement || !audio_enhancement.success) return null;

        return (
            <View className="bg-card rounded-lg p-4 mb-4">
                <View className="flex-row items-center mb-3">
                    <MaterialCommunityIcons
                        name="waveform"
                        size={20}
                        color="#F59E0B"
                    />
                    <Text className="text-text-primary font-semibold ml-2">
                        Audio Enhancement
                    </Text>
                </View>

                {audio_enhancement.processing_steps && (
                    <View className="mb-3">
                        <Text className="text-text-primary font-medium mb-2">
                            Applied Processing
                        </Text>
                        <View className="flex-row flex-wrap">
                            {audio_enhancement.processing_steps.map(
                                (step, index) => (
                                    <View
                                        key={index}
                                        className="bg-warning/20 rounded-full px-3 py-1 mr-2 mb-1"
                                    >
                                        <Text className="text-warning text-sm">
                                            {step
                                                .replace("_", " ")
                                                .toUpperCase()}
                                        </Text>
                                    </View>
                                )
                            )}
                        </View>
                    </View>
                )}

                {audio_enhancement.stats && (
                    <View className="bg-panel rounded-lg p-3">
                        <View className="flex-row justify-between mb-2">
                            <Text className="text-text-secondary text-sm">
                                Quality Score
                            </Text>
                            <Text className="text-text-primary font-semibold">
                                {audio_enhancement.stats.quality_score || "N/A"}
                            </Text>
                        </View>
                        {audio_enhancement.stats.size_reduction && (
                            <View className="flex-row justify-between">
                                <Text className="text-text-secondary text-sm">
                                    Size Reduction
                                </Text>
                                <Text className="text-text-primary font-semibold">
                                    {audio_enhancement.stats.size_reduction}%
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <ScrollView className="flex-1">
            <View className="mb-4">
                <View className="flex-row items-center mb-3">
                    <MaterialCommunityIcons
                        name="robot"
                        size={24}
                        color="#10B981"
                    />
                    <Text className="text-xl font-bold text-text-primary ml-2">
                        AI Processing Results
                    </Text>
                </View>

                <View className="bg-success/20 rounded-lg p-3 mb-4">
                    <Text className="text-success text-sm">
                        ✅ Processing completed in {results.processing_time}s
                    </Text>
                </View>
            </View>

            {renderTranscriptionResults()}
            {renderAnalysisResults()}
            {renderAudioResults()}

            <View className="bg-card rounded-lg p-4 mb-4">
                <Text className="text-text-primary font-medium mb-2">
                    💡 Pro Tips
                </Text>
                <Text className="text-text-secondary text-sm leading-5">
                    • Use the suggested category to improve discoverability
                    {"\n"}• The AI summary can be used as a description{"\n"}•
                    Keywords help with search optimization{"\n"}• High-quality
                    audio gets better engagement
                </Text>
            </View>
        </ScrollView>
    );
};

export default AIProcessingResults;
