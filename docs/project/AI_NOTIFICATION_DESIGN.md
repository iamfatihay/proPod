# AI Processing Notification System - Design Doc

## 🎯 Objective

Implement a modern, user-friendly notification system for AI processing completion that follows mobile app best practices and provides excellent UX even when user navigates away during processing.

---

## 📊 Current Problems

1. **setTimeout + Alert** creates race conditions when user navigates
2. **No persistent notification** - if user is on different screen, they miss it
3. **No notification history** - user can't review past notifications
4. **Not scalable** - only works for current screen

---

## ✨ Solution: Activity Center with Badge Notifications

### Architecture

```
┌──────────────────────────────────────────┐
│  Notification Context (Global State)      │
│  - stores unread notifications            │
│  - manages badge count                    │
│  - persists to AsyncStorage               │
└──────────────────────────────────────────┘
            │
            ├─> Home Screen (Badge on profile icon)
            ├─> Activity/Notifications Page  
            └─> Toast (optional, immediate feedback)
```

### User Flow

**During AI Processing:**
```
1. User clicks "Process with AI"
2. Toast: "🤖 AI processing started..."
3. User can navigate anywhere in app
4. Processing continues in background
```

**When AI Completes:**
```
5. Backend returns success
6. Add notification to NotificationContext:
   {
     id: "ai-process-123",
     type: "ai_complete",
     title: "🎉 AI Processing Complete",
     message: "Your podcast has been analyzed",
     podcast_id: 123,
     created_at: Date.now(),
     read: false
   }
7. Badge appears on profile/bell icon: (+1)
8. Optional: Vibration (if enabled in settings)
9. Optional: Toast (if user is still in app)
```

**User Views Notification:**
```
10. User taps profile icon (sees badge)
11. Opens Activity/Notifications page
12. Sees: "🎉 AI Processing Complete"
13. Taps notification → Navigates to podcast details
14. Notification marked as read, badge disappears
```

---

## 🏗️ Implementation Plan

### Phase 1: Notification Context (1-2 hours)

**File:** `frontend/src/context/useNotificationStore.js`

```javascript
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,

  // Add new notification
  addNotification: (notification) => {
    const newNotification = {
      ...notification,
      id: Date.now().toString(),
      created_at: Date.now(),
      read: false,
    };
    
    set((state) => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
    
    // Persist to storage
    get().saveToStorage();
  },

  // Mark as read
  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
    get().saveToStorage();
  },

  // Mark all as read
  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
    get().saveToStorage();
  },

  // Load from storage
  loadFromStorage: async () => {
    const data = await AsyncStorage.getItem('@notifications');
    if (data) {
      const parsed = JSON.parse(data);
      set(parsed);
    }
  },

  // Save to storage
  saveToStorage: async () => {
    const state = get();
    await AsyncStorage.setItem('@notifications', JSON.stringify({
      notifications: state.notifications,
      unreadCount: state.unreadCount,
    }));
  },
}));

export default useNotificationStore;
```

### Phase 2: Update AI Processing Handler (30 min)

**File:** `frontend/app/(main)/details.js`

```javascript
import useNotificationStore from '../../src/context/useNotificationStore';

const Details = () => {
  const addNotification = useNotificationStore(state => state.addNotification);
  
  const handleProcessAI = async () => {
    try {
      setIsProcessingAI(true);
      showToast("🤖 AI processing started...", "info");

      const result = await apiService.processAudio(podcast.id);
      
      // Update podcast
      setPodcast(prev => ({
        ...prev,
        ai_enhanced: true,
      }));

      // ADD NOTIFICATION (works even if user navigates away!)
      addNotification({
        type: 'ai_complete',
        title: '🎉 AI Processing Complete',
        message: `"${podcast.title}" has been analyzed with AI`,
        podcast_id: podcast.id,
        action: {
          type: 'navigate',
          screen: '/(main)/details',
          params: { id: podcast.id }
        }
      });

      // Optional: Vibration (if enabled)
      try {
        if (Platform.OS !== 'web' && Vibration) {
          Vibration.vibrate([0, 200, 100, 200]);
        }
      } catch (e) {
        Logger.debug("Vibration not supported:", e);
      }

      // Optional: Toast (only if user still on screen)
      showToast("✨ AI processing completed!", "success");
      
      // NO MORE SETTIMEOUT + ALERT!
      
      await loadPodcastDetails();
    } catch (error) {
      Logger.error("AI processing failed:", error);
      showToast(error.response?.data?.detail || "Failed to process with AI", "error");
    } finally {
      setIsProcessingAI(false);
    }
  };
};
```

### Phase 3: Add Badge to Profile Icon (15 min)

**File:** `frontend/app/(main)/home.js`

```javascript
import useNotificationStore from '../../src/context/useNotificationStore';

export default function HomeScreen() {
  const unreadCount = useNotificationStore(state => state.unreadCount);

  return (
    <TouchableOpacity
      onPress={() => router.push("/(main)/profile")}
      style={{ position: 'relative' }}
    >
      {/* Avatar */}
      <Image source={{ uri: user.photo_url }} />
      
      {/* Badge */}
      {unreadCount > 0 && (
        <View style={{
          position: 'absolute',
          top: -4,
          right: -4,
          backgroundColor: '#EF4444',
          borderRadius: 12,
          minWidth: 20,
          height: 20,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: '#000',
        }}>
          <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
```

### Phase 4: Create Notifications Page (1-2 hours)

**File:** `frontend/app/(main)/notifications.js`

```javascript
import useNotificationStore from '../../src/context/useNotificationStore';

export default function Notifications() {
  const notifications = useNotificationStore(state => state.notifications);
  const markAsRead = useNotificationStore(state => state.markAsRead);
  const markAllAsRead = useNotificationStore(state => state.markAllAsRead);

  const handleNotificationPress = (notification) => {
    // Mark as read
    markAsRead(notification.id);
    
    // Navigate to podcast
    if (notification.action) {
      router.push({
        pathname: notification.action.screen,
        params: notification.action.params,
      });
    }
  };

  return (
    <SafeAreaView>
      {/* Header */}
      <View>
        <Text>Notifications ({notifications.filter(n => !n.read).length})</Text>
        <TouchableOpacity onPress={markAllAsRead}>
          <Text>Mark all as read</Text>
        </TouchableOpacity>
      </View>

      {/* Notification List */}
      <FlatList
        data={notifications}
        renderItem={({ item }) => (
          <NotificationCard
            notification={item}
            onPress={() => handleNotificationPress(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}
```

---

## 🎨 UI/UX Details

### Badge Design (Already exists in QuickActionsBar!)
```javascript
position: absolute
top: -4, right: -4
backgroundColor: #EF4444 (red)
borderRadius: 12 (circular)
minWidth: 20, height: 20
fontSize: 10, fontWeight: 700
borderWidth: 2, borderColor: #000 (outline)
```

### Notification Card Design
```
┌─────────────────────────────────────┐
│  🎉  AI Processing Complete    🔵  │ ← Blue dot = unread
│      "Test Podcast" analyzed        │
│      2 minutes ago                   │
│                                      │
│  [View Results →]                   │
└─────────────────────────────────────┘
```

### Color System
- Unread: Blue dot (#3B82F6)
- AI Success: Green icon (#10B981)
- Error: Red icon (#EF4444)
- Background: #1a1a1a (dark theme)

---

## 📱 Modern App Examples

**Instagram:**
- Heart icon with red badge
- Notification page with activity feed
- Tap to view details

**Twitter:**
- Bell icon with blue badge  
- Notification categories (All, Mentions, etc.)
- Swipe to dismiss

**Facebook:**
- Bell icon with red badge
- Notification with thumbnails
- "Mark all as read" option

**Best Practice:** Combine badge + dedicated page (like all major apps)

---

## ⚡ Benefits

1. **No race conditions** - notification saved to global state
2. **Persistent** - user can check anytime
3. **Scalable** - works for any type of notification
4. **Modern UX** - matches user expectations
5. **Accessible** - visual badge + optional vibration
6. **Performant** - uses zustand (same as your audio store)

---

## 🚀 Timeline

- **Phase 1** (NotificationContext): 1-2 hours
- **Phase 2** (Update AI handler): 30 min
- **Phase 3** (Add badge): 15 min
- **Phase 4** (Notifications page): 1-2 hours

**Total: 3-5 hours** for complete implementation

---

## 🔮 Future Enhancements

- Push notifications (when app is closed)
- Notification categories (AI, Comments, Likes)
- Sound preferences
- Do Not Disturb mode
- Notification settings per type

---

## ✅ Checklist

- [ ] Create NotificationContext with zustand
- [ ] Add AsyncStorage persistence
- [ ] Update handleProcessAI to use notifications
- [ ] Add badge to profile icon
- [ ] Create notifications page UI
- [ ] Add NotificationCard component
- [ ] Test: process AI, navigate away, check badge
- [ ] Test: tap notification, navigate to podcast
- [ ] Test: mark as read functionality
- [ ] Remove old setTimeout + Alert code

---

**Author:** Copilot  
**Date:** Feb 4, 2026  
**Status:** Design Complete, Ready for Implementation
