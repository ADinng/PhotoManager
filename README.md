# 📷 PhotoManager

An iOS app to help you organize your photo library — browse by year and month, swipe to keep or delete, and manage deletions safely before they're permanent.

## Features

- **Year/Month Grouping**: Home screen displays months as calendar cards with ring progress indicators and photo counts
- **Overall Progress Bar**: Top of home screen shows total organization progress (reviewed / total photos)
- **One-at-a-time Browsing**: Full-screen photo view per month, with ascending/descending sort toggle
- **Swipe Gestures**: Swipe left to delete (red hint), swipe right to keep (green hint)
- **Bottom Action Buttons**: Undo / Delete / Keep — prevents accidental actions
- **Trash Management**: Deleted photos go to a pending list first; long-press to restore, confirm to permanently delete
- **Auto-save Progress**: Every action is saved automatically — no data lost on unexpected exit
- **Lazy Loading**: Photos load in batches to prevent memory crashes on large libraries

## Project Structure

```
app/
├── _layout.tsx        # Root layout, route registration
├── index.tsx          # Home screen (year/month grid + progress bar)
├── month.tsx          # Month detail screen (swipe interactions)
└── trash.tsx          # Trash screen (pending deletions)
```

## Tech Stack

- [Expo](https://expo.dev) / React Native
- `expo-media-library` — Read and delete photos from device library
- `react-native-gesture-handler` — Swipe gesture handling
- `react-native-reanimated` — Smooth animations
- `react-native-svg` — Ring progress indicators
- `@react-native-async-storage/async-storage` — Local data persistence

## Getting Started

### Install dependencies

```bash
npm install
```

### Start the app

```bash
npx expo start --clear
```

### Run on your phone

1. Install [Expo Go](https://expo.dev/go) from the App Store
2. Make sure your phone and computer are on the same WiFi
3. Scan the QR code in the terminal with your phone camera

> ⚠️ **Note**: Expo Go has memory limitations and may crash when processing large photo libraries. Building a development build is recommended for the best experience.

### Build a local development version (recommended)

```bash
# Requires Xcode to be installed
npx expo run:ios --device
```

## How to Use

1. Open the app and grant photo library access
2. Browse years and months on the home screen with progress rings
3. Tap a month to enter photo review mode
4. Swipe left = delete, swipe right = keep; or use the bottom buttons
5. Tap the trash icon (top right) to view pending deletions
6. In the trash screen, long-press a photo to restore it; tap confirm to permanently delete

## Roadmap

### ✅ v0.1 - Core Features
- [x] Browse photos grouped by year and month
- [x] Swipe left to delete, swipe right to keep
- [x] Trash screen with batch deletion and restore
- [x] Auto-save progress to prevent data loss
- [x] Lazy loading for large photo libraries
- [x] Overall progress bar and ring indicators
- [x] Jump to specific photo index
- [x] Sort by newest / oldest

### 🚧 v0.2 - Stability
- [ ] Build development version to remove Expo Go memory limits
- [ ] Background processing for large libraries
- [ ] Resume from last position automatically after crash

### 🔮 v0.3 - Smart Features
- [ ] Auto-detect duplicate photos
- [ ] Filter by photo type (screenshots, live photos, etc.)
- [ ] Batch select mode for quick deletion
- [ ] iCloud sync support

### 🔮 v0.4 - Polish
- [ ] Dark / light theme
- [ ] Haptic feedback on swipe
- [ ] Statistics page (how many deleted, space saved)
- [ ] iPad support