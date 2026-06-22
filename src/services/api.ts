import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform, NativeModules } from 'react-native';

// Default to 10.0.2.2 (Android Emulator host IP) with fallback to localhost.
// In a real environment, users configure this in EXPO_PUBLIC_API_URL.
const envUrl = process.env.EXPO_PUBLIC_API_URL;
let BASE_URL = envUrl || 'http://10.0.2.2:3000';

// Only dynamically resolve LAN IP if the user hasn't explicitly set EXPO_PUBLIC_API_URL
if (!envUrl) {
  const scriptURL = NativeModules.SourceCode?.scriptURL;
  if (scriptURL) {
    const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
    if (match && match[1]) {
      const host = match[1];
      // Check if the host is a LAN IP (excluding loopbacks like localhost/127.0.0.1 and the emulator default 10.0.2.2)
      const isLanIP =
        (host.startsWith('10.') && host !== '10.0.2.2') ||
        host.startsWith('192.168.') ||
        host.startsWith('172.');

      if (isLanIP) {
        BASE_URL = BASE_URL.replace(/10\.0\.2\.2|localhost|127\.0\.0\.1/, host);
      }
    }
  }
}

// If running in a web browser, replace 10.0.2.2 with localhost/127.0.0.1
if (Platform.OS === 'web' && BASE_URL.includes('10.0.2.2')) {
  BASE_URL = BASE_URL.replace('10.0.2.2', 'localhost');
}

// Ensure the URL starts with http:// or https://
if (!BASE_URL.startsWith('http://') && !BASE_URL.startsWith('https://')) {
  BASE_URL = 'http://' + BASE_URL;
}

console.log('[Taskify API] Base URL resolved to:', BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
});

// Automatically inject JWT Access Token into request headers
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('Error reading secure token:', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
export { BASE_URL };
