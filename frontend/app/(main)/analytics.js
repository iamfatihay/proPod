/**
 * Creator Analytics Screen
 *
 * Displays the creator dashboard from GET /analytics/dashboard:
 *  - Summary stat cards (podcasts, plays, likes, bookmarks, comments, avg completion)
 *  - Recent engagement (last N days) delta row
 *  - Top 5 podcasts by play count
 *  - Category distribution list
 *
 * Allows switching the look-back window between 7 / 30 / 90 / 365 days.
 */
import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from "react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import apiService from "../../src/services/api/apiService";
import { COLORS } from "../../src/constants/theme";
import { buildSecondaryScreenOptions } from "../../src/utils/secondaryScreenOptions";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n) => {
    if (n === null || n === undefined) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
};

// average_completion_rate arrives from the backend already as a percentage
// value in the 0–100 range (e.g. 42 means 42%). Do NOT multiply by 100.
const pct = (n) => {
    if (n === null || n === undefined) return "—";
    return `${Math.round(n)}%`;
};

// ─── StatCard ─────────────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, color, sub }) => (
    <View
        style={{
            flex: 1,
            backgroundColor: COLORS.panel,
            borderRadius: 14,
            padding: 14,
            margin: 4,
            borderWidth: 1,
            borderColor: COLORS.border,
            minWidth: "44%",
        }}
    >
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
            }}
        >
            <View
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: (color || COLORS.primary) + "22",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 8,
                }}
            >
                <MaterialCommunityIcons
                    name={icon}
                    size={18}
                    color={color || COLORS.primary}
                />
            </View>
            <Text
                style={{
                    color: COLORS.text.muted,
                    fontSize: 12,
                    fontWeight: "500",
                    flex: 1,
                }}
                numberOfLines={1}
            >
                {label}
            </Text>
        </View>
        <Text
            style={{
                color: COLORS.text.primary,
                fontSize: 24,
                fontWeight: "700",
                marginBottom: 2,
            }}
        >
            {value}
        </Text>
        {!!sub && (
            <Text style={{ color: COLORS.text.muted, fontSize: 11 }}>
                {sub}
            </Text>
        )}
    </View>
);

// ─── RecentDeltaRow ───────────────────────────────────────────────────────────

const RecentDeltaRow = ({ icon, label, value, color }) => (
    <View
        style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
        }}
    >
        <View
            style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: (color || COLORS.primary) + "22",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
            }}
        >
            <MaterialCommunityIcons
                name={icon}
                size={16}
                color={color || COLORS.primary}
            />
        </View>
        <Text
            style={{ flex: 1, color: COLORS.text.secondary, fontSize: 14 }}
        >
            {label}
        </Text>
        <Text
            style={{
                color: COLORS.text.primary,
                fontSize: 16,
                fontWeight: "700",
            }}
        >
            +{fmt(value)}
        </Text>
    </View>
);

// ─── TopPodcastRow ────────────────────────────────────────────────────────────

// isLast is passed from the parent map to suppress the divider on the final row.
const TopPodcastRow = ({ rank, podcast, onPress, isLast = false }) => (
    <TouchableOpacity
        onPress={() => onPress(podcast.id)}
        activeOpacity={0.7}
        style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 12,
            borderBottomWidth: isLast ? 0 : 1,
            borderBottomColor: COLORS.border,
        }}
    >
        {/* Rank badge */}
        <View
            style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: rank === 1 ? COLORS.primary : COLORS.panel,
                borderWidth: rank !== 1 ? 1 : 0,
                borderColor: COLORS.border,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
            }}
        >
            <Text
                style={{
                    color: rank === 1 ? "white" : COLORS.text.muted,
                    fontSize: 12,
                    fontWeight: "700",
                }}
            >
                {rank}
            </Text>
        </View>

        {/* Title */}
        <View style={{ flex: 1 }}>
            <Text
                style={{
                    color: COLORS.text.primary,
                    fontSize: 14,
                    fontWeight: "500",
                }}
                numberOfLines={1}
            >
                {podcast.title}
            </Text>
            <Text style={{ color: COLORS.text.muted, fontSize: 12, marginTop: 2 }}>
                {podcast.category || "Uncategorized"}
            </Text>
        </View>

        {/* Stats */}
        <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
            <Text
                style={{
                    color: COLORS.text.primary,
                    fontSize: 14,
                    fontWeight: "700",
                }}
            >
                {fmt(podcast.play_count)}
            </Text>
            <Text style={{ color: COLORS.text.muted, fontSize: 11 }}>plays</Text>
        </View>

        <Ionicons
            name="chevron-forward"
            size={16}
            color={COLORS.text.muted}
            style={{ marginLeft: 6 }}
        />
    </TouchableOpacity>
);

// ─── CategoryRow ──────────────────────────────────────────────────────────────
// Backend returns category_distribution as { category, count } where `count`
// is the number of podcasts in that category. There is no per-category
// play count in the current response, so we use `count` for the bar width.

const CategoryRow = ({ cat, maxCount }) => {
    const barWidth =
        maxCount > 0 ? Math.max(4, (cat.count / maxCount) * 100) : 4;

    return (
        <View style={{ marginBottom: 12 }}>
            <View
                style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 4,
                }}
            >
                <Text
                    style={{
                        color: COLORS.text.primary,
                        fontSize: 13,
                        fontWeight: "500",
                    }}
                >
                    {cat.category || "Uncategorized"}
                </Text>
                <Text style={{ color: COLORS.text.muted, fontSize: 12 }}>
                    {cat.count} {cat.count === 1 ? "podcast" : "podcasts"}
                </Text>
            </View>
            {/* Progress bar */}
            <View
                style={{
                    height: 4,
                    backgroundColor: COLORS.border,
                    borderRadius: 2,
                    overflow: "hidden",
                }}
            >
                <View
                    style={{
                        height: 4,
                        width: `${barWidth}%`,
                        backgroundColor: COLORS.primary,
                        borderRadius: 2,
                    }}
                />
            </View>
        </View>
    );
};


// ─── PlaysOverTimeChart ───────────────────────────────────────────────────────
// Pure React Native bar chart — no SVG dependency required.
// Each bar's height is proportional to the maximum play count in the window.

const PlaysOverTimeChart = ({ chartData, days }) => {
    if (!chartData || chartData.length === 0) {
        return (
            <View
                style={{
                    height: 80,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Text style={{ color: COLORS.text.muted, fontSize: 13 }}>
                    No listening data yet for this period.
                </Text>
            </View>
        );
    }

    // Safety-net: fill missing dates with plays:0 so the chart always spans
    // the full selected range even if the API returns a sparse series.
    const filledData = (() => {
        if (!chartData.length) return chartData;
        const map = Object.fromEntries(chartData.map((d) => [d.date, d.plays]));
        const result = [];
        const start = new Date(chartData[0].date + "T00:00:00Z");
        for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setUTCDate(start.getUTCDate() + i);
            const key = d.toISOString().slice(0, 10);
            result.push({ date: key, plays: map[key] ?? 0 });
        }
        return result;
    })();

    const maxPlays = Math.max(...filledData.map((d) => d.plays), 1);

    // How many bars to show — cap at 14 for readability, evenly spaced
    const MAX_BARS = days <= 14 ? days : 14;
    // Build an evenly-sampled subset when we have more points than bars
    let display = filledData;
    if (filledData.length > MAX_BARS) {
        // Use floor + dedup to guarantee unique indices and avoid duplicate points
        const step = (filledData.length - 1) / (MAX_BARS - 1);
        const seen = new Set();
        display = Array.from({ length: MAX_BARS }, (_, i) => {
            let idx = Math.floor(i * step);
            while (seen.has(idx) && idx < filledData.length - 1) idx++;
            seen.add(idx);
            return filledData[idx];
        });
    }

    // Short label: "Apr 1" → "1" if <= 14 bars, else just show first/mid/last
    const labelFor = (dateStr, idx, arr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr + "T00:00:00");
        const day = d.getDate();
        if (arr.length <= 7) return String(day);
        // show label at first, middle, last
        if (idx === 0 || idx === arr.length - 1 || idx === Math.floor(arr.length / 2)) {
            return `${d.toLocaleString("default", { month: "short" })} ${day}`;
        }
        return "";
    };

    return (
        <View>
            {/* Bars */}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "flex-end",
                    height: 80,
                    gap: 3,
                }}
            >
                {display.map((point, idx) => {
                    const heightPct = Math.max(
                        4,
                        Math.round((point.plays / maxPlays) * 100)
                    );
                    const isMax = point.plays === maxPlays;
                    return (
                        <View
                            key={idx}
                            style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: 80 }}
                        >
                            <View
                                style={{
                                    width: "100%",
                                    height: `${heightPct}%`,
                                    backgroundColor: isMax
                                        ? COLORS.primary
                                        : COLORS.primary + "55",
                                    borderRadius: 3,
                                    minHeight: 3,
                                }}
                            />
                        </View>
                    );
                })}
            </View>

            {/* X-axis labels */}
            <View
                style={{
                    flexDirection: "row",
                    marginTop: 6,
                    gap: 3,
                }}
            >
                {display.map((point, idx) => (
                    <View
                        key={idx + "_lbl"}
                        style={{ flex: 1, alignItems: "center" }}
                    >
                        <Text
                            style={{
                                color: COLORS.text.muted,
                                fontSize: 9,
                                textAlign: "center",
                            }}
                            numberOfLines={1}
                        >
                            {labelFor(point.date, idx, display)}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Peak annotation */}
            <View
                style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    marginTop: 8,
                }}
            >
                <Text style={{ color: COLORS.text.muted, fontSize: 11 }}>
                    Peak:{" "}
                    <Text style={{ color: COLORS.text.primary, fontWeight: "600" }}>
                        {maxPlays}
                    </Text>{" "}
                    sessions/day
                </Text>
            </View>
        </View>
    );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

const Section = ({ title, children }) => (
    <View
        style={{
            backgroundColor: COLORS.panel,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: COLORS.border,
        }}
    >
        <Text
            style={{
                color: COLORS.text.primary,
                fontSize: 16,
                fontWeight: "700",
                marginBottom: 14,
            }}
        >
            {title}
        </Text>
        {children}
    </View>
);

// ─── DAY_OPTIONS ─────────────────────────────────────────────────────────────

const DAY_OPTIONS = [
    { label: "7d", value: 7 },
    { label: "30d", value: 30 },
    { label: "90d", value: 90 },
    { label: "1yr", value: 365 },
];

// ─── AnalyticsScreen ─────────────────────────────────────────────────────────

const AnalyticsScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [days, setDays] = useState(30);
    const [data, setData] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(
        async (isRefresh = false) => {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            try {
                const [dashRes, chartRes] = await Promise.all([
                    apiService.getCreatorDashboard(days),
                    apiService.getPlaysOverTime(days),
                ]);
                setData(dashRes);
                setChartData(chartRes?.data ?? []);
                setError(null);
            } catch (e) {
                setError(e?.message || "Failed to load analytics");
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [days]
    );

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    const handlePodcastPress = (podcastId) => {
        router.push({ pathname: "/(main)/details", params: { id: podcastId } });
    };

    // ── Empty state ──────────────────────────────────────────────────────────
    if (!loading && data && data.total_podcasts === 0) {
        return (
            <SafeAreaView
                style={{
                    flex: 1,
                    backgroundColor: COLORS.background,
                }}
            >
                <Stack.Screen
                    options={buildSecondaryScreenOptions({
                        router,
                        title: "Creator Analytics",
                        backgroundColor: COLORS.background,
                    })}
                />

                <View
                    style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 40,
                    }}
                >
                    <MaterialCommunityIcons
                        name="chart-line-variant"
                        size={64}
                        color={COLORS.border}
                    />
                    <Text
                        style={{
                            color: COLORS.text.secondary,
                            fontSize: 18,
                            fontWeight: "600",
                            marginTop: 16,
                            textAlign: "center",
                        }}
                    >
                        No podcasts yet
                    </Text>
                    <Text
                        style={{
                            color: COLORS.text.muted,
                            fontSize: 14,
                            marginTop: 8,
                            textAlign: "center",
                        }}
                    >
                        Publish your first episode to start seeing analytics.
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.push("/(main)/create")}
                        style={{
                            marginTop: 24,
                            backgroundColor: COLORS.primary,
                            borderRadius: 12,
                            paddingHorizontal: 28,
                            paddingVertical: 12,
                        }}
                    >
                        <Text
                            style={{
                                color: "white",
                                fontWeight: "700",
                                fontSize: 15,
                            }}
                        >
                            Create a Podcast
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ── Main view ────────────────────────────────────────────────────────────
    // Use `count` (podcast count per category) as the bar denominator.
    const maxCatCount =
        data?.category_distribution?.reduce(
            (max, c) => Math.max(max, c.count ?? 0),
            0
        ) || 0;

    return (
        <SafeAreaView
            style={{
                flex: 1,
                backgroundColor: COLORS.background,
            }}
        >
            <Stack.Screen
                options={buildSecondaryScreenOptions({
                    router,
                    title: "Creator Analytics",
                    backgroundColor: COLORS.background,
                })}
            />

            {/* Day range picker */}
            <View
                style={{
                    flexDirection: "row",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: COLORS.border,
                    gap: 8,
                }}
            >
                {DAY_OPTIONS.map((opt) => (
                    <TouchableOpacity
                        key={opt.value}
                        onPress={() => setDays(opt.value)}
                        style={{
                            paddingHorizontal: 16,
                            paddingVertical: 6,
                            borderRadius: 20,
                            backgroundColor:
                                days === opt.value
                                    ? COLORS.primary
                                    : COLORS.panel,
                            borderWidth: 1,
                            borderColor:
                                days === opt.value
                                    ? COLORS.primary
                                    : COLORS.border,
                        }}
                        activeOpacity={0.7}
                    >
                        <Text
                            style={{
                                color:
                                    days === opt.value
                                        ? "white"
                                        : COLORS.text.secondary,
                                fontSize: 13,
                                fontWeight: "600",
                            }}
                        >
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Loading */}
            {loading ? (
                <View
                    style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : error ? (
                <View
                    style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 32,
                    }}
                >
                    <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={48}
                        color={COLORS.error}
                    />
                    <Text
                        style={{
                            color: COLORS.error,
                            fontSize: 15,
                            marginTop: 12,
                            textAlign: "center",
                        }}
                    >
                        {error}
                    </Text>
                    <TouchableOpacity
                        onPress={() => load()}
                        style={{ marginTop: 16 }}
                    >
                        <Text
                            style={{
                                color: COLORS.primary,
                                fontWeight: "600",
                            }}
                        >
                            Retry
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={{
                        padding: 16,
                        paddingBottom: insets.bottom + 24,
                    }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => load(true)}
                            tintColor={COLORS.primary}
                        />
                    }
                >
                    {/* ── All-time summary stats ────────────────────────── */}
                    <Text
                        style={{
                            color: COLORS.text.muted,
                            fontSize: 12,
                            fontWeight: "600",
                            letterSpacing: 0.8,
                            textTransform: "uppercase",
                            marginBottom: 10,
                        }}
                    >
                        All-time totals
                    </Text>

                    <View
                        style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            marginHorizontal: -4,
                            marginBottom: 16,
                        }}
                    >
                        <StatCard
                            icon="podcast"
                            label="Podcasts"
                            value={fmt(data?.total_podcasts)}
                            color={COLORS.primary}
                        />
                        <StatCard
                            icon="play-circle-outline"
                            label="Total Plays"
                            value={fmt(data?.total_plays)}
                            color="#3B82F6"
                        />
                        <StatCard
                            icon="heart-outline"
                            label="Likes"
                            value={fmt(data?.total_likes)}
                            color="#EC4899"
                        />
                        <StatCard
                            icon="bookmark-outline"
                            label="Bookmarks"
                            value={fmt(data?.total_bookmarks)}
                            color="#F59E0B"
                        />
                        <StatCard
                            icon="comment-outline"
                            label="Comments"
                            value={fmt(data?.total_comments)}
                            color="#10B981"
                        />
                        <StatCard
                            icon="chart-donut"
                            label="Avg Completion"
                            value={pct(data?.average_completion_rate)}
                            color="#8B5CF6"
                            sub="across all episodes"
                        />
                    </View>

                    {/* ── Recent engagement ────────────────────────────── */}
                    <Section title={`Last ${days} days`}>
                        <RecentDeltaRow
                            icon="heart-outline"
                            label="New likes"
                            value={data?.recent_likes}
                            color="#EC4899"
                        />
                        <RecentDeltaRow
                            icon="bookmark-outline"
                            label="New bookmarks"
                            value={data?.recent_bookmarks}
                            color="#F59E0B"
                        />
                        <RecentDeltaRow
                            icon="comment-outline"
                            label="New comments"
                            value={data?.recent_comments}
                            color="#10B981"
                        />
                    </Section>

                    {/* ── Plays over time ─────────────────────────────── */}
                    <Section title={`Listening Activity — Last ${days} Days`}>
                        <PlaysOverTimeChart chartData={chartData} days={days} />
                    </Section>

                    {/* ── Top podcasts ─────────────────────────────────── */}
                    {data?.top_podcasts?.length > 0 && (
                        <Section title="Top Episodes">
                            {data.top_podcasts.map((p, i, arr) => (
                                <TopPodcastRow
                                    key={p.id}
                                    rank={i + 1}
                                    podcast={p}
                                    onPress={handlePodcastPress}
                                    isLast={i === arr.length - 1}
                                />
                            ))}
                        </Section>
                    )}

                    {/* ── Category distribution ────────────────────────── */}
                    {data?.category_distribution?.length > 0 && (
                        <Section title="By Category">
                            {data.category_distribution.map((cat) => (
                                <CategoryRow
                                    key={cat.category || "uncategorized"}
                                    cat={cat}
                                    maxCount={maxCatCount}
                                />
                            ))}
                        </Section>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

export default AnalyticsScreen;
