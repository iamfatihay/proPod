import {
    View,
    Text,
    SafeAreaView,
    TextInput,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Keyboard,
    Platform,
    StatusBar,
    Image,
} from "react-native";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import PodcastCard from "../../src/components/PodcastCard";
import SemanticSearchService from "../../src/services/ai/SemanticSearchService";
import apiService from "../../src/services/api/apiService";
import useAudioStore from "../../src/context/useAudioStore";
import Logger from "../../src/utils/logger";
import { normalizePodcasts } from "../../src/utils/urlHelper";
import { COLORS } from "../../src/constants/theme";

// ─── CreatorCard ─────────────────────────────────────────────────────────────

const CreatorCard = ({ creator, onPress }) => {
    const [following, setFollowing] = React.useState(creator.is_following ?? false);
    const [loading, setLoading] = React.useState(false);

    // Sync follow state when the creator prop changes (e.g. new search results
    // virtualizing the same card slot with a different creator).
    React.useEffect(() => {
        setFollowing(creator.is_following ?? false);
    }, [creator.id, creator.is_following]);

    const handleFollowToggle = async () => {
        if (loading) return;
        setLoading(true);
        const was = following;
        setFollowing(!was);
        try {
            if (was) {
                await apiService.unfollowCreator(creator.id);
            } else {
                await apiService.followCreator(creator.id);
            }
        } catch (err) {
            // Roll back optimistic update
            setFollowing(was);
            const status = err?.response?.status ?? err?.status;
            if (status === 401) {
                // Unauthenticated — silently revert; app-level auth guard handles redirect
                Logger.warn("CreatorCard: follow attempt without auth");
            } else {
                Logger.error("CreatorCard: follow toggle failed", err);
            }
        } finally {
            setLoading(false);
        }
    };

    const initials = (creator.name || "?")
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    return (
        <TouchableOpacity
            onPress={onPress}
            className="flex-row items-center px-4 py-3 border-b border-border"
            activeOpacity={0.7}
        >
            {creator.photo_url ? (
                <Image
                    source={{ uri: creator.photo_url }}
                    className="w-12 h-12 rounded-full bg-panel"
                />
            ) : (
                <View className="w-12 h-12 rounded-full bg-primary items-center justify-center">
                    <Text className="text-white font-bold text-base">{initials}</Text>
                </View>
            )}
            <View className="flex-1 ml-3">
                <Text className="text-text-primary font-semibold" numberOfLines={1}>
                    {creator.name}
                </Text>
                <Text className="text-text-secondary text-xs mt-0.5">
                    {creator.podcast_count === 1
                        ? "1 podcast"
                        : `${creator.podcast_count} podcasts`}
                    {"  ·  "}
                    {creator.total_followers === 1
                        ? "1 follower"
                        : `${creator.total_followers} followers`}
                </Text>
            </View>
            <TouchableOpacity
                onPress={handleFollowToggle}
                disabled={loading}
                className={`px-3 py-1.5 rounded-full border ${
                    following ? "border-border bg-transparent" : "border-primary bg-primary"
                }`}
            >
                <Text
                    className={`text-xs font-semibold ${
                        following ? "text-text-secondary" : "text-white"
                    }`}
                >
                    {following ? "Following" : "Follow"}
                </Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

const Search = () => {
    const router = useRouter();
    const { play, setQueue, currentTrack, isPlaying, pause } = useAudioStore();

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMode, setSearchMode] = useState("all"); // 'all' | 'transcriptions' | 'creators'
    const [creatorResults, setCreatorResults] = useState([]);
    const [showHistory, setShowHistory] = useState(true);
    const searchInputRef = useRef(null);

    useEffect(() => {
        // Load search history on mount
        loadSearchHistory();
    }, []);

    // Autofocus the search input every time the Search tab is focused,
    // so the keyboard appears instantly (consistent with Instagram/Spotify).
    useFocusEffect(
        useCallback(() => {
            const timeout = setTimeout(() => {
                searchInputRef.current?.focus();
            }, Platform.OS === "android" ? 250 : 100);
            return () => clearTimeout(timeout);
        }, [])
    );

    useEffect(() => {
        // Debounced live search — fire results as the user types (>=2 chars).
        // Keyword suggestions load alongside so recent searches and live hits
        // are both surfaced without requiring a submit.
        const trimmed = searchQuery.trim();
        if (trimmed.length < 2) {
            setSuggestions([]);
            setShowHistory(true);
            setSearchResults([]);
            setCreatorResults([]);
            return;
        }

        loadSuggestions();
        const handle = setTimeout(() => {
            if (searchMode === "creators") {
                performCreatorSearch(trimmed);
            } else {
                performSearch(trimmed, { silent: true });
            }
        }, 350);
        return () => clearTimeout(handle);
    }, [searchQuery, searchMode]);

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

    const performSearch = async (query, options = {}) => {
        // Trim once here so all downstream calls (API, history) use the clean value.
        const q = (query || "").trim();
        if (q.length === 0) {
            setSearchResults([]);
            return;
        }

        const { silent = false } = options;

        try {
            setIsSearching(true);
            setShowHistory(false);
            // Only dismiss the keyboard on explicit submit — silent live
            // search must not fight the user's typing.
            if (!silent) {
                Keyboard.dismiss();
                // Record query in local history (used for suggestions / recent
                // searches). Skip for silent live search to avoid polluting
                // history with every keystroke.
                SemanticSearchService.addToHistory(q);
            }

            let results;
            if (searchMode === "transcriptions") {
                // Transcription search is still client-side (backend has no
                // dedicated transcript search endpoint yet).
                results = await SemanticSearchService.searchTranscriptions(q);
                // SemanticSearchService already normalizes URLs internally;
                // apply normalizePodcasts for consistency.
                setSearchResults(normalizePodcasts(results));
            } else {
                // Delegate to the backend search endpoint for scalability.
                // Returns already-normalized podcast objects from apiService.
                results = await apiService.searchPodcasts(q, { limit: 50 });
                setSearchResults(results);
            }
        } catch (error) {
            Logger.error("Search failed:", error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };


    const performCreatorSearch = async (query) => {
        const q = (query || "").trim();
        if (q.length === 0) {
            setCreatorResults([]);
            return;
        }
        try {
            setIsSearching(true);
            setShowHistory(false);
            const results = await apiService.searchUsers(q, { limit: 30 });
            setCreatorResults(Array.isArray(results) ? results : []);
        } catch (error) {
            Logger.error("Creator search failed:", error);
            setCreatorResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchSubmit = () => {
        if (searchMode === "creators") {
            performCreatorSearch(searchQuery);
        } else {
            performSearch(searchQuery);
        }
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
                ownerId: podcast.owner?.id ?? podcast.owner_id,
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
        <SafeAreaView 
            className="flex-1 bg-background"
            style={{
                paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
            }}
        >
            {/* Search Header */}
            <View className="px-4 py-3 pb-6 border-b border-border">
                <View className="flex-row items-center bg-panel rounded-lg px-3">
                    <Ionicons name="search" size={20} color="#888" />
                    <TextInput
                        ref={searchInputRef}
                        className="flex-1 py-3 px-3 text-text-primary"
                        placeholder={
                            searchMode === "creators"
                                ? "Search creators by name..."
                                : searchMode === "transcriptions"
                                ? "Search by spoken phrase..."
                                : "Search podcasts..."
                        }
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
                                setCreatorResults([]);
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
                    {[
                        { key: "all", label: "Podcasts" },
                        { key: "creators", label: "Creators" },
                        { key: "transcriptions", label: "Transcripts" },
                    ].map(({ key, label }, i, arr) => (
                        <TouchableOpacity
                            key={key}
                            onPress={() => {
                                setSearchMode(key);
                                setSearchResults([]);
                                setCreatorResults([]);
                            }}
                            className={`flex-1 py-2 rounded-lg ${
                                i < arr.length - 1 ? "mr-1" : ""
                            } ${i > 0 ? "ml-1" : ""} ${
                                searchMode === key ? "bg-primary" : "bg-panel"
                            }`}
                        >
                            <Text
                                className={`text-center text-xs font-medium ${
                                    searchMode === key
                                        ? "text-white font-semibold"
                                        : "text-text-secondary"
                                }`}
                            >
                                {label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Content */}
            {isSearching ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text className="text-text-secondary mt-3">
                        {searchMode === "transcriptions"
                            ? "🤖 Scanning transcriptions..."
                            : searchMode === "creators"
                            ? "Searching creators..."
                            : "Searching podcasts..."}
                    </Text>
                </View>
            ) : searchMode === "creators" && creatorResults.length > 0 ? (
                <FlatList
                    data={creatorResults}
                    keyExtractor={(item) => `creator-${item.id}`}
                    renderItem={({ item }) => (
                        <CreatorCard
                            creator={item}
                            onPress={() =>
                                router.push({
                                    pathname: "/(main)/creator-profile",
                                    params: { id: item.id },
                                })
                            }
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            ) : searchResults.length > 0 ? (
                <FlatList
                    data={searchResults}
                    renderItem={renderSearchResult}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
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
                    <Ionicons
                        name={searchMode === "creators" ? "people-outline" : "search-outline"}
                        size={64}
                        color="#444"
                    />
                    <Text className="text-text-primary text-xl font-semibold mt-4">
                        {searchMode === "transcriptions"
                            ? "Transcription Search"
                            : searchMode === "creators"
                            ? "Find Creators"
                            : "Search Podcasts"}
                    </Text>
                    <Text className="text-text-secondary text-center mt-2">
                        {searchMode === "transcriptions"
                            ? "Find podcasts by exact phrases spoken in the episode."
                            : searchMode === "creators"
                            ? "Search by name to discover and follow podcast creators."
                            : "Search by title or description across all public podcasts."}
                    </Text>
                </View>
            )}
        </SafeAreaView>
    );
};

export default Search;
