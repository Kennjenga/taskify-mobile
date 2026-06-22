# Taskify Frontend Mobile Client

This is the mobile application frontend for the Taskify Task Management application, built with **React Native (Expo)**, **TypeScript**, and **Zustand**.

---

## 📋 Prerequisites

Before running the application, make sure you have the following installed on your machine:

1. **Node.js**: Version `18.x` or later.
2. **Package Manager**: `npm` (comes with Node.js) or `yarn`.
3. **Expo Go app**: Installed on your physical iOS or Android device (available in App Store / Google Play Store) if you wish to run the app on a physical device.
4. **Android Studio / Xcode**: Optional, if you want to run the project in a simulator/emulator.

---

## 🚀 Setup & Launch Instructions

### 1. Install Dependencies
Navigate to the `frontend` folder and install the required npm packages:
```bash
cd frontend
npm install
```

### 2. Configure Environment Variables
Copy the `.env.example` file to create your local `.env` configuration:
```bash
cp .env.example .env
```

Open the newly created `.env` file and set the `EXPO_PUBLIC_API_URL` to match your environment.

### 3. Run the Development Server
Start the Expo development server:
```bash
npm start
```
*(or `npx expo start`)*

Once the Metro bundler starts, you can:
- **Scan the QR Code**: Use the **Expo Go** app on your phone (or your device's Camera app) to scan the QR code displayed in the terminal to load the application over your local Wi-Fi.
- **Run on Android Emulator**: Press `a` in the terminal to boot the project inside an active Android emulator.
- **Run on iOS Simulator**: Press `i` in the terminal (macOS only) to boot the project inside the iOS simulator.
- **Run on Web browser**: Press `w` in the terminal to open the web browser build.
- **Tunnel mode**: Run `npx expo start --tunnel` if your computer and device are on different networks or behind strict firewalls.

---

## ⚙️ Environment Configuration Template

Below is the environment configuration template (`.env.example`):

```env
# The base URL of the Taskify Express API server.
# For iOS Simulator or Web: http://localhost:3000
# For Android Emulator: http://10.0.2.2:3000
# For Real Mobile Devices: http://<YOUR_LOCAL_IP>:3000
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000

# GitHub OAuth Client ID (for real social login)
EXPO_PUBLIC_GITHUB_CLIENT_ID=
```

*Note: Our API service features **Zero-Config Dynamic LAN IP Resolution**. If you run the app on a physical device over Wi-Fi, it will automatically detect the local network IP of your workstation from the bundle URL and replace `10.0.2.2` or `localhost` dynamically so that the app connects to the API automatically.*

### 🛠️ Setting up GitHub OAuth Social Login

To enable GitHub social login:
1. Register a new OAuth Application on [GitHub Developer Settings](https://github.com/settings/developers).
2. Set **Homepage URL** to `https://expo.dev`.
3. Set **Authorization callback URL** to:
   - For local development: `taskify://redirect` (custom scheme config) or standard Expo Go redirect scheme proxy: `https://auth.expo.io/@your-expo-username/frontend`.
4. Copy your Client ID and Client Secret from GitHub.
5. Configure your keys in your `.env` files:
   - In [frontend/.env](file:///c:/Users/user/Desktop/Ken/tests/taskify/frontend/.env), set `EXPO_PUBLIC_GITHUB_CLIENT_ID=your_client_id_here`.
   - In [backend/.env](file:///c:/Users/user/Desktop/Ken/tests/taskify/backend/.env), set `GITHUB_CLIENT_ID=your_client_id_here` and `GITHUB_CLIENT_SECRET=your_client_secret_here`.
6. Restart the backend and frontend dev servers. You will now be able to log in using real GitHub accounts by clicking **"GitHub"** on the login screen.

---

## 🧠 Engineering & Architectural Breakdown

### 1. State Management Pattern: Zustand
We chose **Zustand** as the primary state management library for the following reasons:
- **Low Boilerplate**: Unlike Redux Toolkit, which requires actions, reducers, and slice setups, Zustand allows us to define stores in a few lines of clean, readable TypeScript.
- **Lightweight & High Performance**: Zustand uses selector-based re-rendering, meaning components only subscribe to the specific states they use, preventing unnecessary re-renders.
- **Asynchronous Flow Integration**: Handlers for API calls (using Axios) are defined directly inside the stores as async actions, decoupling business and network logic from the UI view components.

Our stores are structured into:
1. **`authStore`**: Manages authentication status, user profiles, registration, login, and secure session credentials.
2. **`taskStore`**: Manages the CRUD flow for tasks, cache loading, and synchronization queues.

### 2. Architectural Decisions & Trade-Offs

#### 🔑 Keychain Security: Expo SecureStore vs. AsyncStorage
- **Trade-off**: `AsyncStorage` saves values as plain text in the device's storage, exposing sensitive JWT tokens.
- **Decision**: We use **Expo SecureStore** to store the user's `accessToken` and `refreshToken` securely in native keychain structures (iOS Keychain and Android KeyStore), ensuring they are encrypted. Standard task metadata and offline sync queues continue to use the standard `AsyncStorage` cache.

#### 📴 Offline Resilience and ID Mapping
- **Trade-off**: When users create tasks offline, the app assigns them temporary IDs (`temp_xxx`). If they create multiple tasks and update/delete them before reconnecting, standard sequential sync engines will fail because the server issues database UUIDs and ignores the client's temporary IDs.
- **Decision**: We designed a sequential sync engine. When a `create` action resolves online, it logs a mapping from `temp_xxx` to the server-issued UUID in a map. Subsequent updates and deletes check this map and swap out the temporary ID for the new server-issued ID before making the API request.

#### 🔄 Session Expiration
- **Trade-off**: To avoid writing complex silent-refresh handling and token expiration middleware on the client-side, we intercept API responses.
- **Decision**: The Axios interceptor listens for `401 Unauthorized` responses. If a token expires, the client performs a clean wipe of secure storage and gracefully redirects the user back to the login screen.
