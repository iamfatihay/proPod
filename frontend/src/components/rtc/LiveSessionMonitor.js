/**
 * Live session monitoring component for host dashboard
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const LiveSessionMonitor = ({ sessionId, participants }) => {
  const [duration, setDuration] = useState(0);
  const [storageEstimate, setStorageEstimate] = useState(0);

  // Use a ref to track duration inside the interval without adding it to
  // the dependency array, which would recreate the interval every second.
  const durationRef = useRef(0);

  useEffect(() => {
    // Tick every second: increment duration counter
    const durationInterval = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);

    // Update storage estimate every 10 seconds in a separate interval so the
    // calculation always uses the latest duration and participant count without
    // triggering re-creation of the main duration interval.
    const storageInterval = setInterval(() => {
      const participantCount = participants.filter(p => p.role !== 'viewer').length;
      const estimate = (durationRef.current / 3600) * 300 * Math.max(1, participantCount);
      setStorageEstimate(estimate);
    }, 10000);

    return () => {
      clearInterval(durationInterval);
      clearInterval(storageInterval);
    };
  // participants changes should restart the storage interval with fresh count;
  // duration is intentionally excluded — durationRef tracks it without re-mounting.
  }, [participants]);

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatStorageSize = (mb) => {
    if (mb < 1024) return `${Math.round(mb)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const getConnectionIcon = (quality) => {
    switch (quality) {
      case 'EXCELLENT':
      case 'GOOD':
        return <Ionicons name="wifi" size={16} color="#10b981" />;
      case 'FAIR':
        return <Ionicons name="wifi" size={16} color="#f59e0b" />;
      case 'POOR':
      case 'DISCONNECTED':
        return <Ionicons name="wifi-outline" size={16} color="#ef4444" />;
      default:
        return <Ionicons name="help-circle-outline" size={16} color="#6b7280" />;
    }
  };

  const renderParticipant = ({ item }) => {
    const isSpeaking = item.audioLevel > 20;

    return (
      <View className="flex-row items-center justify-between p-3 bg-gray-800 rounded-lg mb-2">
        <View className="flex-row items-center flex-1">
          <View
            className={`h-2 w-2 rounded-full mr-2 ${
              isSpeaking ? 'bg-green-500' : 'bg-gray-600'
            }`}
          />
          <Text className="text-white font-medium">{item.displayName}</Text>
          <Text className="text-gray-400 text-sm ml-2">({item.role})</Text>
        </View>

        <View className="flex-row items-center space-x-2">
          {item.isAudioMuted ? (
            <Ionicons name="mic-off" size={16} color="#ef4444" />
          ) : (
            <Ionicons name="mic" size={16} color="#10b981" />
          )}

          {item.isVideoMuted ? (
            <Ionicons name="videocam-off" size={16} color="#ef4444" />
          ) : (
            <Ionicons name="videocam" size={16} color="#10b981" />
          )}

          {getConnectionIcon(item.connectionQuality)}

          <View className="w-8 h-4 bg-gray-700 rounded overflow-hidden">
            <View
              className="h-full bg-blue-500"
              style={{ width: `${Math.min(item.audioLevel, 100)}%` }}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 p-4 bg-gray-900">
      {/* Header Stats */}
      <View className="flex-row justify-between mb-4">
        <View className="bg-gray-800 p-3 rounded-lg flex-1 mr-2">
          <Text className="text-gray-400 text-xs">Duration</Text>
          <Text className="text-white text-lg font-bold">{formatDuration(duration)}</Text>
        </View>

        <View className="bg-gray-800 p-3 rounded-lg flex-1 ml-2">
          <Text className="text-gray-400 text-xs">Est. Storage</Text>
          <Text className="text-white text-lg font-bold">{formatStorageSize(storageEstimate)}</Text>
        </View>
      </View>

      {/* Participant Stats */}
      <View className="flex-row justify-between mb-4">
        <View className="bg-gray-800 p-3 rounded-lg flex-1 mr-2">
          <Text className="text-gray-400 text-xs">Speakers</Text>
          <Text className="text-white text-lg font-bold">
            {participants.filter(p => p.role !== 'viewer').length}
          </Text>
        </View>

        <View className="bg-gray-800 p-3 rounded-lg flex-1 ml-2">
          <Text className="text-gray-400 text-xs">Viewers</Text>
          <Text className="text-white text-lg font-bold">
            {participants.filter(p => p.role === 'viewer').length}
          </Text>
        </View>
      </View>

      {/* Participant List */}
      <Text className="text-white font-bold mb-2">Active Participants</Text>
      <FlatList
        data={participants}
        renderItem={renderParticipant}
        keyExtractor={(item) => item.peerId}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

export default LiveSessionMonitor;
