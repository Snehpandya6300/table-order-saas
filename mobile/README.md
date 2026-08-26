# QR Table Order — Staff Mobile App

React Native (Expo) app for restaurant staff to manage orders, menus, and tables.

## Setup

```bash
cd mobile
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and set your Convex URL:

```
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

### Run

```bash
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or run on a simulator.

## Features

- **Dashboard** — Today's orders, revenue, pending count at a glance
- **Orders** — Real-time order feed, advance status (Received → Accepted → Preparing → Ready → Served), mark payment (Cash / UPI / Card)
- **Menu** — Create/edit categories and items, toggle availability, vegetarian flag
- **Tables** — Create tables, view/regenerate QR tokens, share QR links, enable/disable
- **Settings** — Edit restaurant details, view subscription status, sign out

## Tech Stack

- React Native + Expo SDK 52
- Expo Router (file-based navigation)
- React Native Paper (Material Design 3)
- Convex (shared backend with the web app)
