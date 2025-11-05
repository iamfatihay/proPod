import {
    View,
    Text,
    SafeAreaView,
    TextInput,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Keyboard,
} from "react-native";
import React, { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import PodcastCard from "../../src/components/PodcastCard";
import SemanticSearchService from "../../src/services/ai/SemanticSearchService";
import useAudioStore from "../../src/context/useAudioStore";
import Logger from "../../src/utils/logger";
import { normalizePodcasts } from "../../src/utils/urlHelper";

const Search = () => {
    const router = useRouter();
    const { play, setQueue, currentTrack, isPlaying, pause } = useAudioStore();

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMode, setSearchMode] = useState("all"); // 'all' or 'transcriptions'
    const [showHistory, setShowHistory] = useState(true);

    useEffect(() => {
        // Load search history on mount
        loadSearchHistory();
    }, []);

    useEffect(() => {
        // Get suggestions as user types
        if (searchQuery.length >= 2) {
            loadSuggestions();
        } else {
            setSuggestions([]);
            setShowHistory(true);
        }
    }, [searchQuery]);

    const loadSearchHistory = () => {
        const history = SemanticSearchService.getSearchHistory();
        setSuggestions(history);
    };

    const loadSuggestions = async () => {
        try {
            const suggs = await SemanticSearchService.getSearchSuggestions(
                searchQuery
            );
            setSuggestions(suggs);
        } catch (error) {
            Logger.error("Failed to load suggestions:", error);
        }
    };

    const performSearch = async (query) => {
        if (!query || query.trim().length === 0) {
            setSearchResults([]);
            return;
        }

        try {
            setIsSearching(true);
            setShowHistory(false);
            Keyboard.dismiss();

            let results;
            if (searchMode === "transcriptions") {
                results = await SemanticSearchService.searchTranscriptions(
                    query
                );
            } else {
                results = await SemanticSearchService.searchPodcasts(query);
            }

            // Normalize URLs (relative to absolute)
            setSearchResults(normalizePodcasts(results));
            Logger.log(`🔍 Search completed: ${results.length} results`);
        } catch (error) {
            Logger.error("Search failed:", error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchSubmit = () => {
        performSearch(searchQuery);
    };

    const handleSuggestionPress = (suggestion) => {
        setSearchQuery(suggestion);
        performSearch(suggestion);
    };

    const handlePodcastPress = (podcast) => {
        router.push({
            pathname: "/(main)/details",
            params: { id: podcast.id },
        });
    };

    const handlePlayPress = async (podcast) => {
        try {
            const track = {
                id: podcast.id,
                uri: podcast.audio_url,
                title: podcast.title,
                artist: podcast.owner?.name || "Unknown Artist",
                duration: podcast.duration || 0,
                artwork: podcast.thumbnail_url,
            };

            if (currentTrack?.id === podcast.id) {
                if (isPlaying) {
                    await pause();
                } else {
                    await play();
                }
            } else {
                await play(track);
            }
        } catch (error) {
            Logger.error("Play failed:", error);
        }
    };

    const renderSearchResult = ({ item }) => (
        <PodcastCard
            podcast={item}
            onPress={() => handlePodcastPress(item)}
            onPlayPress={() => handlePlayPress(item)}
            isPlaying={currentTrack?.id === item.id && isPlaying}
        />
    );

    const renderSuggestion = ({ item }) => (
        <TouchableOpacity
            onPress={() => handleSuggestionPress(item)}
            className="flex-row items-center px-4 py-3 border-b border-border"
        >
            <Ionicons
                name={showHistory ? "time-outline" : "search-outline"}
                size={20}
                color="#888"
            />
            <Text className="text-text-primary ml-3 flex-1">{item}</Text>
            <Ionicons name="arrow-forward" size={16} color="#888" />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView className="flex-1 bg-background">
            {/* Search Header */}
            <View className="px-4 py-3 border-b border-border">
                <View className="flex-row items-center bg-panel rounded-lg px-3">
                    <Ionicons name="search" size={20} color="#888" />
                    <TextInput
                        className="flex-1 py-3 px-3 text-text-primary"
                        placeholder="Search podcasts..."
                        placeholderTextColor="#888"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearchSubmit}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => {
                                setSearchQuery("");
                                setSearchResults([]);
                                setSuggestions([]);
                                loadSearchHistory();
                                setShowHistory(true);
                            }}
                        >
                            <Ionicons
                                name="close-circle"
                                size={20}
                                color="#888"
                            />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Search Mode Toggle */}
                <View className="flex-row items-center mt-3">
                    <TouchableOpacity
                        onPress={() => setSearchMode("all")}
                        className={`flex-1 py-2 rounded-lg mr-2 ${
                            searchMode === "all" ? "bg-primary" : "bg-panel"
                        }`}
                    >
                        <Text
                            className={`text-center ${
                                searchMode === "all"
                                    ? "text-white font-semibold"
                                    : "text-text-secondary"
                            }`}
                        >
                            All Content
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setSearchMode("transcriptions")}
                        className={`flex-1 py-2 rounded-lg ml-2 ${
                            searchMode === "transcriptions"
                                ? "bg-primary"
                                : "bg-panel"
                        }`}
                    >
                        <Text
                            className={`text-center ${
                                searchMode === "transcriptions"
                                    ? "text-white font-semibold"
                                    : "text-text-secondary"
                            }`}
                        >
                            Transcriptions
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content */}
            {isSearching ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#D32F2F" />
                    <Text className="text-text-secondary mt-3">
                        🤖 AI is analyzing content...
                    </Text>
                </View>
            ) : searchResults.length > 0 ? (
                <FlatList
                    data={searchResults}
                    renderItem={renderSearchResult}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ padding: 16 }}
                />
            ) : suggestions.length > 0 && searchQuery.length >= 0 ? (
                <View className="flex-1">
                    <Text className="text-text-secondary px-4 py-3">
                        {showHistory ? "Recent Searches" : "Suggestions"}
                    </Text>
                    <FlatList
                        data={suggestions}
                        renderItem={renderSuggestion}
                        keyExtractor={(item, index) => `suggestion-${index}`}
                    />
                </View>
            ) : (
                <View className="flex-1 items-center justify-center px-8">
                    <Ionicons name="search-outline" size={64} color="#444" />
                    <Text className="text-text-primary text-xl font-semibold mt-4">
                        Semantic Search
                    </Text>
                    <Text className="text-text-secondary text-center mt-2">
                        Powered by AI. Search by topic, mood, keywords, or even
                        specific phrases from transcriptions.
                    </Text>
                </View>
            )}
        </SafeAreaView>
    );
};

export default Search;
