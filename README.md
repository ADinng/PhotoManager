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