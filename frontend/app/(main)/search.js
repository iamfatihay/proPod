import {
    View,
    Text,
    SafeAreaView,
    TextInput,
    FlatList,
    ScrollView,
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

// ─── Category constants ───────────────────────────────────────────────────────

// Maps backend category strings → Ionicons names.
const CATEGORY_ICON_MAP = {
    Technology: "laptop-outline",
    Business: "briefcase-outline",
    "Health & Wellness": "fitness-outline",
    Science: "flask-outline",
    Education: "school-outline",
    Entertainment: "film-outline",
    "Food & Drink": "restaurant-outline",
    Music: "musical-notes-outline",
    Sports: "football-outline",
    News: "newspaper-outline",
    Comedy: "happy-outline",
    Society: "people-outline",
    History: "time-outline",
    Politics: "megaphone-outline",
    Art: "color-palette-outline",
    Finance: "cash-outline",
};

const ALL_CATEGORY = { id: "all", label: "All", icon: "apps" };

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

// ─── Main component ───────────────────────────────────────────────────────────

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

    // Creator sort — only active in "creators" mode.
    const [creatorSortBy, setCreatorSortBy] = useState("name"); // 'name' | 'followers'

    // Category filter — only active in "all" (Podcasts) mode.
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [categories, setCategories] = useState([ALL_CATEGORY]);

    const searchInputRef = useRef(null);

    // Load search history on mount.
    useEffect(() => {
        loadSearchHistory();
    }, []);

    // Fetch category list from backend once on mount; backend returns categories
    // sorted by podcast count so the most popular ones appear first.
    useEffect(() => {
        apiService
            .getDiscoverCategories()
            .then((apiCategories) => {
                if (!Array.isArray(apiCategories) || apiCategories.length === 0)
                    return;
                const enriched = apiCategories.map((c) => ({
                    id: c.category,
                    label: c.category,
                    icon: CATEGORY_ICON_MAP[c.category] || "grid-outline",
                }));
                setCategories([ALL_CATEGORY, ...enriched]);
            })
            .catch((err) => {
                // Non-critical — "All" chip still works without the full list.
                Logger.warn("Search: failed to load categories", err);
            });
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

    // Debounced live search — fires as the user types (≥2 chars) OR when the
    // category chip selection changes while a query is already active.
    useEffect(() => {
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
                performCreatorSearch(trimmed, { sort_by: creatorSortBy });
            } else {
                performSearch(trimmed, { silent: true });
            }
        }, 350);
        return () => clearTimeout(handle);
    }, [searchQuery, searchMode, selectedCategory, creatorSortBy]);

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
        const q = (query || "").trim();
        if (q.length === 0) {
            setSearchResults([]);
            return;
        }

        const { silent = false } = options;

        try {
            setIsSearching(true);
            setShowHistory(false);
            if (!silent) {
                Keyboard.dismiss();
                SemanticSearchService.addToHistory(q);
            }

            let results;
            if (searchMode === "transcriptions") {
                results = await SemanticSearchService.searchTranscriptions(q);
                setSearchResults(normalizePodcasts(results));
            } else {
                // Pass category only when a specific one is selected.
                const params = { limit: 50 };
                if (selectedCategory !== "all") {
                    params.category = selectedCategory;
                }
                results = await apiService.searchPodcasts(q, params);
                setSearchResults(results);
            }
        } catch (error) {
            Logger.error("Search failed:", error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const performCreatorSearch = async (query, options = {}) => {
        const q = (query || "").trim();
        if (q.length === 0) {
            setCreatorResults([]);
            return;
        }
        try {
            setIsSearching(true);
            setShowHistory(false);
            const { sort_by = "name" } = options;
            const results = await apiService.searchUsers(q, { limit: 30, sort_by });
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
            performCreatorSearch(searchQuery, { sort_by: creatorSortBy });
        } else {
            performSearch(searchQuery);
        }
    };

    const handleSuggestionPress = (suggestion) => {
        setSearchQuery(suggestion);
        performSearch(suggestion);
    };

    const handleModeChange = (key) => {
        setSearchMode(key);
        setSearchResults([]);
        setCreatorResults([]);
        // Reset category filter when switching away from Podcasts mode.
        if (key !== "all") {
            setSelectedCategory("all");
        }
    };

    const handleCategorySelect = (categoryId) => {
        setSelectedCategory(categoryId);
        // The useEffect with selectedCategory in its dep array re-triggers
        // the debounced search automatically — no manual call needed here.
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

    // Number of results shown in the active-filter label.
    const resultCount = searchResults.length;
    const hasActiveFilter = searchMode === "all" && selectedCategory !== "all";

    return (
        <SafeAreaView
            className="flex-1 bg-background"
            style={{
                paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
            }}
        >
            {/* Search Header */}
            <View className="px-4 py-3 border-b border-border">
                {/* Search input */}
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
                            <Ionicons name="close-circle" size={20} color="#888" />
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
                            onPress={() => handleModeChange(key)}
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

                {/* Sort toggle — Creators mode only */}
                {searchMode === "creators" && (
                    <View className="flex-row items-center mt-3">
                        <Text className="text-text-secondary text-xs mr-2">Sort:</Text>
                        {[
                            { key: "name", label: "Name" },
                            { key: "followers", label: "Followers" },
                        ].map(({ key, label }) => (
                            <TouchableOpacity
                                key={key}
                                onPress={() => {
                                    setCreatorSortBy(key);
                                    if (searchQuery.trim().length >= 2) {
                                        performCreatorSearch(searchQuery, { sort_by: key });
                                    }
                                }}
                                style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 5,
                                    borderRadius: 16,
                                    marginRight: 6,
                                    backgroundColor:
                                        creatorSortBy === key
                                            ? COLORS.primary
                                            : "rgba(128,128,128,0.12)",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontWeight: creatorSortBy === key ? "700" : "500",
                                        color: creatorSortBy === key ? "#fff" : "#888",
                                    }}
                                >
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Category filter chips — Podcasts mode only */}
                {searchMode === "all" && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="mt-3 -mx-1"
                        contentContainerStyle={{ paddingHorizontal: 4 }}
                    >
                        {categories.map((cat) => {
                            const isActive = selectedCategory === cat.id;
                            return (
                                <TouchableOpacity
                                    key={cat.id}
                                    onPress={() => handleCategorySelect(cat.id)}
                                    activeOpacity={0.7}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 20,
                                        marginRight: 8,
                                        backgroundColor: isActive
                                            ? COLORS.primary
                                            : "rgba(128,128,128,0.12)",
                                    }}
                                >
                                    <Ionicons
                                        name={cat.icon}
                                        size={13}
                                        color={isActive ? "#fff" : "#888"}
                                        style={{ marginRight: 5 }}
                                    />
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontWeight: isActive ? "700" : "500",
                                            color: isActive ? "#fff" : "#888",
                                        }}
                                    >
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}
            </View>

            {/* Active filter label */}
            {hasActiveFilter && (
                <View className="flex-row items-center px-4 py-2 bg-panel border-b border-border">
                    <Ionicons name="funnel" size={13} color={COLORS.primary} />
                    <Text className="text-text-secondary text-xs ml-1.5 flex-1">
                        {resultCount} result{resultCount !== 1 ? "s" : ""} in{" "}
                        <Text style={{ color: COLORS.primary, fontWeight: "600" }}>
                            {selectedCategory}
                        </Text>
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedCategory("all")}>
                        <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: "600" }}>
                            Clear
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Content */}
            {isSearching ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text className="text-text-secondary mt-3">
                        {searchMode === "transcriptions"
                            ? "🤖 Scanning transcriptions..."
                            : searchMode === "creators"
                            ? "Searching creators..."
                            : hasActiveFilter
                            ? `Filtering by ${selectedCategory}...`
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
