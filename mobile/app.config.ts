import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Dynamic Expo config — replaces app.json.
 * 
 * Key behavior: The `react-native-google-mobile-ads` plugin is ONLY included
 * when the build platform is NOT Android. This avoids the Gradle/Kotlin version
 * conflict that crashes the Android build.
 * 
 * EAS_BUILD_PLATFORM is set by EAS Build to "ios" or "android".
 * During local `expo start`, it's undefined — plugin is included (safe for iOS dev).
 */

// Only exclude the ads plugin when explicitly building for Android via EAS
const isAndroidBuild = process.env.EAS_BUILD_PLATFORM === 'android';

const plugins: any[] = [
    "expo-router",
    "expo-secure-store",
    "expo-audio",
    "expo-font",
    "@react-native-google-signin/google-signin",
    "expo-apple-authentication",
    [
        "expo-location",
        {
            locationAlwaysAndWhenInUsePermission:
                "Allow Elementle to access your location for regional leaderboards.",
        },
    ],
];

// Only include Google Mobile Ads plugin on non-Android builds
// During local dev (EAS_BUILD_PLATFORM undefined), include it for iOS simulator
if (!isAndroidBuild) {
    plugins.push([
        "react-native-google-mobile-ads",
        {
            androidAppId: "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy",
            iosAppId: "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy",
        },
    ]);
}

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: "Elementle",
    slug: "mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/Icon-512.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: false,
    scheme: "elementle",
    splash: {
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
    },
    ios: {
        buildNumber: "11",
        supportsTablet: true,
        bundleIdentifier: "com.dobl.elementlegame",
        usesAppleSignIn: true,
        associatedDomains: [
            "applinks:elementle.tech",
            "applinks:www.elementle.tech",
        ],
        infoPlist: {
            NSPhotoLibraryUsageDescription:
                "Allow Elementle to access your photos to save or share game content.",
            NSMicrophoneUsageDescription:
                "Allow Elementle to access the microphone for game audio features.",
            NSLocationWhenInUseUsageDescription:
                "Allow Elementle to access your location for regional leaderboards.",
            NSLocationAlwaysAndWhenInUseUsageDescription:
                "Allow Elementle to access your location for regional leaderboards.",
            NSUserTrackingUsageDescription:
                "This identifier will be used to deliver personalized ads to you.",
            ITSAppUsesNonExemptEncryption: false,
            CFBundleURLTypes: [
                {
                    CFBundleURLSchemes: [
                        "com.googleusercontent.apps.426763707720-m7cq94j06j16bsehf9fpnb3omcp503e8",
                    ],
                },
            ],
        },
    },
    android: {
        package: "com.dobl.elementlegame",
        adaptiveIcon: {
            foregroundImage: "./assets/Icon-512.png",
            backgroundColor: "#ffffff",
        },
        edgeToEdgeEnabled: true,
        // @ts-ignore - Expo SDK feature flag
        predictiveBackGestureEnabled: false,
        permissions: [
            "android.permission.RECORD_AUDIO",
            "android.permission.MODIFY_AUDIO_SETTINGS",
            "android.permission.ACCESS_COARSE_LOCATION",
            "android.permission.ACCESS_FINE_LOCATION",
        ],
    },
    web: {
        favicon: "./assets/favicon.png",
        bundler: "metro",
        output: "single",
    },
    plugins,
    extra: {
        router: {
            origin: false,
        },
        eas: {
            projectId: "f566ab94-4e6b-48bd-8393-6ed577d17db2",
        },
    },
});
