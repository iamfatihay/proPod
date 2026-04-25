import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Switch,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import apiService from "../../src/services/api/apiService";
import CustomModal, { ModalActions } from "../../src/components/CustomModal";
import ConfirmationModal from "../../src/components/ConfirmationModal";
import PlaylistMosaic from "../../src/components/PlaylistMosaic";
import { useToast } from "../../src/components/Toast";
import { COLORS } from "../../src/constants/theme";

// ─── Playlist Card ─────────────────────────────────────────────────────────────

const PlaylistCard = ({ playlist, onPress, onEdit, onDelete }) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        className="flex-row items-center bg-panel rounded-2xl px-4 py-4 mb-3 border border-border"
    >
        {/* Cover art mosaic (falls back to icon bubble when no thumbnails) */}
        <View className="mr-4">
            <PlaylistMosaic
                thumbnails={playlist.preview_thumbnails}
                isPublic={playlist.is_public}
                size={48}
            />
        </View>

        {/* Info */}
        <View className="flex-1">
            <Text className="text-text-primary font-semibold text-base" numberOfLines={1}>
                {playlist.name}
            </Text>
            {playlist.description ? (
                <Text className="text-text-secondary text-xs mt-0.5" numberOfLines={1}>
                    {playlist.description}
                </Text>
            ) : null}
            <Text className="text-text-secondary text-xs mt-1">
                {playlist.item_count ?? 0} episode{playlist.item_count !== 1 ? "s" : ""} ·{" "}
                {playlist.is_public ? "Public" : "Private"}
            </Text>
        </View>

        {/* Actions */}
        <View className="flex-row items-center ml-2">
            <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); onEdit(); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="p-1 mr-2"
            >
                <MaterialCommunityIcons name="pencil-outline" size={18} color={COLORS.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); onDelete(); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="p-1"
            >
                <MaterialCommunityIcons name="delete-outline" size={18} color={COLORS.error} />
            </TouchableOpacity>
        </View>
    </TouchableOpacity>
);

// ─── Playlist Form Modal ────────────────────────────────────────────────────────

const PlaylistFormModal = ({ visible, onClose, onSave, initial = null }) => {
    const [name, setName] = useState(initial?.name ?? "");
    const [description, setDescription] = useState(initial?.description ?? "");
    const [isPublic, setIsPublic] = useState(initial?.is_public ?? false);
    const [saving, setSaving] = useState(false);

    // Reset form when modal opens with new `initial`
    React.useEffect(() => {
        if (visible) {
            setName(initial?.name ?? "");
            setDescription(initial?.description ?? "");
            setIsPublic(initial?.is_public ?? false);
        }
    }, [visible, initial]);

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            await onSave({ name: name.trim(), description: description.trim(), is_public: isPublic });
        } finally {
            setSaving(false);
        }
    };

    return (
        <CustomModal
            visible={visible}
            onClose={onClose}
            title={initial ? "Edit Playlist" : "New Playlist"}
            animationType="slide"
        >
            {/* Name */}
            <Text className="text-text-secondary text-sm mb-1">Name *</Text>
            <TextInput
                value={name}
                onChangeText={setName}
                placeholder="My Playlist"
                placeholderTextColor={COLORS.text.muted}
                className="bg-background border border-border rounded-xl px-4 py-3 text-text-primary mb-4"
                maxLength={100}
                autoFocus
            />

            {/* Description */}
            <Text className="text-text-secondary text-sm mb-1">Description</Text>
            <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description"
                placeholderTextColor={COLORS.text.muted}
                className="bg-background border border-border rounded-xl px-4 py-3 text-text-primary mb-4"
                maxLength={500}
                multiline
                numberOfLines={3}
                style={{ textAlignVertical: "top", minHeight: 72 }}
            />

            {/* Public toggle */}
            <View className="flex-row items-center justify-between mb-2">
                <View>
                    <Text className="text-text-primary font-medium">Public playlist</Text>
                    <Text className="text-text-secondary text-xs">Anyone can view this playlist</Text>
                </View>
                <Switch
                    value={isPublic}
                    onValueChange={setIsPublic}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor="#FFFFFF"
                />
            </View>

            <ModalActions
                onCancel={onClose}
                onConfirm={handleSave}
                cancelText="Cancel"
                confirmText={initial ? "Save" : "Create"}
                loading={saving}
                destructive={false}
            />
        </CustomModal>
    );
};

// ─── Main Screen ────────────────────────────────────────────────────────────────

const Playlists = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { showToast } = useToast();

    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Form modal state
    const [formVisible, setFormVisible] = useState(false);
    const [editTarget, setEditTarget] = useState(null); // null = create mode

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const loadPlaylists = useCallback(async () => {
        try {
            const res = await apiService.getMyPlaylists();
            setPlaylists(res.playlists || []);
            setError(null);
        } catch (e) {
            setError(e?.detail || e?.message || "Failed to load playlists");
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            (async () => {
                setLoading(true);
                await loadPlaylists();
                setLoading(false);
            })();
        }, [loadPlaylists])
    );

    // Create or update a playlist
    const handleSave = async (data) => {
        try {
            if (editTarget) {
                const updated = await apiService.updatePlaylist(editTarget.id, data);
                setPlaylists((prev) =>
                    prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
                );
                showToast("Playlist updated", "success");
            } else {
                const created = await apiService.createPlaylist(data);
                setPlaylists((prev) => [created, ...prev]);
                showToast("Playlist created", "success");
            }
            setFormVisible(false);
            setEditTarget(null);
        } catch (e) {
            showToast(e?.detail || e?.message || "Failed to save playlist", "error");
        }
    };

    const openCreate = () => {
        setEditTarget(null);
        setFormVisible(true);
    };

    const openEdit = (playlist) => {
        setEditTarget(playlist);
        setFormVisible(true);
    };

    const confirmDelete = (playlist) => {
        setDeleteTarget(playlist);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await apiService.deletePlaylist(deleteTarget.id);
            setPlaylists((prev) => prev.filter((p) => p.id !== deleteTarget.id));
            showToast("Playlist deleted", "success");
        } catch (e) {
            showToast(e?.detail || e?.message || "Failed to delete playlist", "error");
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
            {/* Header */}
            <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
                <Text className="text-text-primary text-2xl font-bold">Playlists</Text>
                <TouchableOpacity
                    onPress={openCreate}
                    className="flex-row items-center bg-primary px-3 py-2 rounded-xl"
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
                    <Text className="text-white font-semibold ml-1 text-sm">New</Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View className="flex-1 px-4 pt-2">
                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color={COLORS.primary} size="large" />
                    </View>
                ) : error ? (
                    <View className="flex-1 items-center justify-center">
                        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={COLORS.error} />
                        <Text className="text-error mt-3 text-center">{error}</Text>
                        <TouchableOpacity
                            onPress={loadPlaylists}
                            className="mt-4 bg-panel border border-border px-5 py-2 rounded-xl"
                        >
                            <Text className="text-text-primary">Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : playlists.length === 0 ? (
                    <View className="flex-1 items-center justify-center">
                        <MaterialCommunityIcons
                            name="playlist-music-outline"
                            size={64}
                            color={COLORS.text.muted}
                        />
                        <Text className="text-text-secondary mt-4 text-base">No playlists yet</Text>
                        <Text className="text-text-secondary text-sm mt-1 text-center px-8">
                            Create your first playlist to organise episodes you love.
                        </Text>
                        <TouchableOpacity
                            onPress={openCreate}
                            className="mt-6 bg-primary px-6 py-3 rounded-xl flex-row items-center"
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
                            <Text className="text-white font-semibold ml-2">Create Playlist</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={playlists}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={({ item }) => (
                            <PlaylistCard
                                playlist={item}
                                onPress={() =>
                                    router.push({
                                        pathname: "/(main)/playlist-detail",
                                        params: { id: item.id, name: item.name },
                                    })
                                }
                                onEdit={() => openEdit(item)}
                                onDelete={() => confirmDelete(item)}
                            />
                        )}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    />
                )}
            </View>

            {/* Create / Edit modal */}
            <PlaylistFormModal
                visible={formVisible}
                onClose={() => { setFormVisible(false); setEditTarget(null); }}
                onSave={handleSave}
                initial={editTarget}
            />

            {/* Delete confirmation */}
            <ConfirmationModal
                visible={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Delete Playlist"
                message={`"${deleteTarget?.name}" will be permanently deleted. Episodes inside are not affected.`}
                confirmText="Delete"
                cancelText="Cancel"
                destructive
                loading={deleting}
                icon="trash-outline"
            />
        </SafeAreaView>
    );
};

export default Playlists;
