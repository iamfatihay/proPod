/**
 * Draft Recovery Modal
 * Shows when user has unsaved recording on app startup
 */

import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const DraftRecoveryModal = ({ visible, draft, onResume, onSave, onDiscard }) => {
    if (!draft) return null;

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const totalDuration = draft.total_duration || 0;
    const segmentCount = draft.segments?.length || 0;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* App Logo Icon */}
                    <View style={styles.iconContainer}>
                        <Image 
                            source={require('../../assets/Volo-logo.png')} 
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>Unsaved Recording Found</Text>

                    {/* Info */}
                    <View style={styles.infoContainer}>
                        <View style={styles.infoRow}>
                            <Ionicons name="time-outline" size={20} color={COLORS.text.secondary} />
                            <Text style={styles.infoText}>
                                {formatDuration(totalDuration)} recorded
                            </Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Ionicons name="albums-outline" size={20} color={COLORS.text.secondary} />
                            <Text style={styles.infoText}>
                                {segmentCount} segment{segmentCount !== 1 ? 's' : ''}
                            </Text>
                        </View>
                    </View>

                    {/* Description */}
                    <Text style={styles.description}>
                        You have an unsaved recording. What would you like to do?
                    </Text>

                    {/* Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.saveButton]}
                            onPress={onSave}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="save-outline" size={20} color="#fff" />
                            <Text style={styles.buttonText}>Save Now</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.resumeButton]}
                            onPress={onResume}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="play-circle-outline" size={20} color="#fff" />
                            <Text style={styles.buttonText}>Continue Recording</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.discardButton]}
                            onPress={onDiscard}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                            <Text style={[styles.buttonText, styles.discardText]}>
                                Discard
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.text.primary,
        marginBottom: 16,
        textAlign: 'center',
    },
    infoContainer: {
        width: '100%',
        backgroundColor: COLORS.panel,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        gap: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoText: {
        fontSize: 15,
        color: COLORS.text.secondary,
        fontWeight: '500',
    },
    description: {
        fontSize: 14,
        color: COLORS.text.secondary,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    buttonContainer: {
        width: '100%',
        gap: 12,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    logo: {
        width: 80,
        height: 80,
    },
    saveButton: {
        backgroundColor: COLORS.primary,
    },
    resumeButton: {
        backgroundColor: COLORS.accent,
    },
    discardButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.error,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    discardText: {
        color: COLORS.error,
    },
});

export default DraftRecoveryModal;
