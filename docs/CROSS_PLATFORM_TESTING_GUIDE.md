# 📱 Cross-Platform Testing Guide

## Overview

This guide covers testing the redesigned home screen across iOS and Android platforms, ensuring consistent behavior and optimal performance.

---

## 🎯 Testing Checklist

### Visual Testing

#### iOS (iPhone 12, 13, 14, 15)
- [ ] Mode toggle renders correctly
- [ ] Gradient cards display properly
- [ ] Shadows appear smooth
- [ ] Hero section gradients render
- [ ] Status bar styling (light/dark)
- [ ] Safe area insets respected
- [ ] Notch/Dynamic Island compatibility

#### Android (Various devices)
- [ ] Elevation shadows work
- [ ] Material Design ripples
- [ ] Navigation bar handling
- [ ] Different screen densities
- [ ] Fold/flip device support
- [ ] System gestures compatibility

### Interaction Testing

#### Mode Toggle
- [ ] Tap to switch modes (iOS & Android)
- [ ] Animation smooth (60 FPS)
- [ ] Haptic feedback (iOS)
- [ ] Tutorial tooltip appears once
- [ ] State persists on app restart
- [ ] Accessibility labels work

#### Gradient Cards
- [ ] Horizontal scroll smooth
- [ ] Touch targets adequate (44x44 minimum)
- [ ] Play button works
- [ ] Long press behavior
- [ ] Swipe gestures
- [ ] Loading states

#### Hero Section
- [ ] Continue listening shows when applicable
- [ ] CTA buttons responsive
- [ ] Stats display correctly (Studio mode)
- [ ] Gradient backgrounds render
- [ ] Animation performance

#### Quick Actions
- [ ] Horizontal scroll smooth
- [ ] Badge numbers visible
- [ ] Icon press feedback
- [ ] Overflow handling
- [ ] First action emphasis

### Performance Testing

#### Metrics to Monitor
```bash
# iOS (Xcode Instruments)
- Time Profiler: Check render times
- Allocations: Memory usage
- Energy Log: Battery impact
- Network: API call efficiency

# Android (Profiler)
- CPU: Animation overhead
- Memory: Heap allocations
- Network: Request patterns
- Battery: Power consumption
```

#### Expected Results
- Screen render: < 100ms
- Animation FPS: 60 (iOS), 60-120 (Android 120Hz)
- Memory usage: < 150MB
- API response: < 500ms

---

## 🧪 Manual Testing Scenarios

### Scenario 1: New User First Launch
**Steps:**
1. Install fresh app
2. Login/signup
3. Land on home screen
4. Observe mode toggle tutorial
5. Try switching modes

**Expected:**
- Tutorial tooltip appears
- Smooth animation on toggle
- Content changes appropriately
- Empty state shows CTA

**Devices:**
- iPhone 15 Pro (iOS 17)
- Pixel 8 (Android 14)
- Samsung Galaxy S23 (Android 13)

### Scenario 2: Returning User with History
**Steps:**
1. Open app (already logged in)
2. Check hero section
3. Verify "Continue Listening"
4. Scroll through For You feed

**Expected:**
- Last played podcast shown
- Progress indicator accurate
- Gradient cards load smoothly
- Play button works

### Scenario 3: Creator Mode Switch
**Steps:**
1. Toggle to Studio mode
2. Observe hero change
3. Check quick actions
4. Verify "Your Podcasts" section

**Expected:**
- Hero shows recording CTA
- Quick actions update
- Latest episode stats visible
- No flicker/jump

### Scenario 4: Network Error Handling
**Steps:**
1. Turn off internet
2. Pull to refresh
3. Observe error state
4. Turn on internet
5. Tap "Try Again"

**Expected:**
- Error state displays
- Retry button works
- Smooth recovery
- Toast notification

### Scenario 5: Empty State (No Content)
**Steps:**
1. Fresh account (no podcasts)
2. Observe empty state
3. Switch between modes

**Expected:**
- Mode-specific empty states
- Encouraging CTA
- Icon and text clear
- Button leads to correct flow

---

## 🔧 Automated Testing

### Unit Tests
```bash
cd frontend
npm test -- --coverage

# Run specific test
npm test GradientCard.test.js
npm test ModeToggle.test.js
npm test useViewModeStore.test.js
```

### Integration Tests
```bash
# (Future: Detox E2E)
npm run test:e2e:ios
npm run test:e2e:android
```

### Snapshot Tests
```javascript
// Add to component tests
it("matches snapshot (iOS)", () => {
  const tree = renderer.create(<GradientCard {...props} />).toJSON();
  expect(tree).toMatchSnapshot();
});
```

---

## 📊 Device Matrix

### iOS Testing Matrix

| Device         | OS     | Screen Size | Priority | Status |
|----------------|--------|-------------|----------|--------|
| iPhone 15 Pro  | 17.x   | 6.1"        | High     | ✅     |
| iPhone 14      | 16.x   | 6.1"        | High     | ⏳     |
| iPhone SE (3)  | 16.x   | 4.7"        | Medium   | ⏳     |
| iPad Air       | 17.x   | 10.9"       | Low      | ⏳     |
| iPhone 13 Mini | 15.x   | 5.4"        | Medium   | ⏳     |

### Android Testing Matrix

| Device          | OS   | Screen Size | Priority | Status |
|-----------------|------|-------------|----------|--------|
| Pixel 8         | 14   | 6.2"        | High     | ✅     |
| Galaxy S23      | 13   | 6.1"        | High     | ⏳     |
| OnePlus 11      | 13   | 6.7"        | Medium   | ⏳     |
| Galaxy Z Fold 5 | 13   | 7.6" fold   | Low      | ⏳     |
| Xiaomi 13       | 13   | 6.36"       | Medium   | ⏳     |

---

## 🐛 Common Issues & Solutions

### Issue 1: Gradient Not Rendering on Android
**Symptoms:** Gradient appears solid or missing  
**Solution:** Check `expo-linear-gradient` version compatibility

```bash
npx expo install expo-linear-gradient
```

### Issue 2: Haptics Not Working on iOS
**Symptoms:** No vibration on toggle  
**Solution:** Check permissions and device settings

```javascript
// In ModeToggle.js
if (Platform.OS === "ios") {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
```

### Issue 3: Animation Jank on Low-End Android
**Symptoms:** Stuttering during mode toggle  
**Solution:** Reduce animation complexity or use LayoutAnimation

```javascript
// Alternative for Android
import { LayoutAnimation } from "react-native";
LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
```

### Issue 4: BlurView Not Working
**Symptoms:** Transparent background instead of blur  
**Solution:** Check platform-specific blur implementations

```javascript
// iOS uses native blur, Android may need fallback
<BlurView intensity={20} tint="light">
  {/* Fallback for Android */}
  <View style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
</BlurView>
```

### Issue 5: ScrollView Performance
**Symptoms:** Lag during horizontal scroll  
**Solution:** Enable native optimizations

```javascript
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  decelerationRate="fast"
  snapToInterval={196} // card width + margin
  snapToAlignment="start"
/>
```

---

## 🎨 Visual Regression Testing

### Setup Percy/Applitools (Optional)
```bash
npm install --save-dev @percy/cli

# Take screenshots
npx percy exec -- npm test
```

### Manual Screenshot Comparison
1. Take baseline screenshots on both platforms
2. After changes, take new screenshots
3. Use diff tool to compare

**Tools:**
- Xcode Simulator: Cmd+S
- Android Emulator: Ctrl+S
- Figma: Import and overlay

---

## 🚀 Performance Profiling

### iOS with Xcode Instruments

1. **Time Profiler**
   ```
   Product > Profile > Time Profiler
   - Record home screen interaction
   - Check for heavy stack traces
   - Optimize hot paths
   ```

2. **Allocations**
   ```
   Product > Profile > Allocations
   - Monitor memory during scroll
   - Check for leaks
   - Verify cleanup on unmount
   ```

### Android with Profiler

1. **CPU Profiler**
   ```
   View > Tool Windows > Profiler
   - Record home screen session
   - Analyze method traces
   - Identify bottlenecks
   ```

2. **Memory Profiler**
   ```
   View > Tool Windows > Profiler
   - Track allocations during scroll
   - Check for memory leaks
   - Analyze heap dumps
   ```

---

## 📝 Test Reports

### Format
```markdown
## Test Session Report

**Date:** YYYY-MM-DD
**Tester:** Name
**Platform:** iOS/Android
**Device:** Model
**OS Version:** X.X

### Results
- [ ] Visual rendering: PASS/FAIL
- [ ] Interactions: PASS/FAIL
- [ ] Performance: PASS/FAIL
- [ ] Accessibility: PASS/FAIL

### Issues Found
1. [Description]
   - Severity: Critical/High/Medium/Low
   - Steps to reproduce
   - Screenshot/video

### Notes
[Additional observations]
```

---

## 🔍 Accessibility Testing

### iOS VoiceOver
```
Settings > Accessibility > VoiceOver
- Navigate home screen
- Verify element labels
- Check focus order
```

### Android TalkBack
```
Settings > Accessibility > TalkBack
- Navigate home screen
- Verify content descriptions
- Check touch exploration
```

### WCAG Compliance
- [ ] Color contrast ≥ 4.5:1
- [ ] Touch targets ≥ 44x44 pt
- [ ] Screen reader support
- [ ] Keyboard navigation
- [ ] Focus indicators

---

## 🎯 Sign-Off Criteria

Before marking cross-platform testing as complete:

1. **Visual**: All components render correctly on iOS & Android
2. **Functional**: All interactions work as expected
3. **Performance**: Meets defined metrics
4. **Accessibility**: VoiceOver/TalkBack functional
5. **Edge Cases**: Error states, empty states tested
6. **Regression**: Existing features still work
7. **Documentation**: This guide updated

---

## 📞 Reporting Issues

### Bug Report Template
```markdown
**Platform:** iOS/Android
**Device:** Model
**OS Version:** X.X
**App Version:** X.X.X

**Issue:** [Brief description]

**Steps to Reproduce:**
1. ...
2. ...

**Expected:** [What should happen]
**Actual:** [What actually happens]

**Screenshots/Video:** [Attach]

**Logs:** [Paste relevant logs]
```

---

**Last Updated:** November 5, 2025  
**Next Review:** After major OS updates or Expo SDK upgrades

