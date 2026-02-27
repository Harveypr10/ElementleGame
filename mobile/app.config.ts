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
    [
        "expo-build-properties",
        {
            android: {
                compileSdkVersion: 35,
                targetSdkVersion: 35,
            },
        },
    ],
    "expo-router",
    "expo-secure-store",
    "expo-audio",
    "expo-font",
    "@react-native-google-signin/google-signin",
    "expo-apple-authentication",
    [
        "@sentry/react-native/expo",
        {
            organization: "dobl-ltd",
            project: "elementle-mobile",
        },
    ],
    "./plugins/withSentryAllowFailure",
    [
        "expo-location",
        {
            locationAlwaysAndWhenInUsePermission:
                "Allow Elementle to access your location for regional leaderboards.",
        },
    ],
];

// Only include Google Mobile Ads plugin on non-Android builds
// During local dev (EAS_BUILD_PLATFORM undefined), include it for iOS simulator - Android is the test code, ios is real
if (!isAndroidBuild) {
    plugins.push([
        "react-native-google-mobile-ads",
        {
            androidAppId: "ca-app-pub-6974310366527526~3682153035",
            iosAppId: "ca-app-pub-6974310366527526~9453354469",
            delayAppMeasurementInit: true,
            skAdNetworkItems: [
                "cstr6suwn9.skadnetwork",
                "4fzdc2evr5.skadnetwork",
                "2fnua5tdw4.skadnetwork",
                "ydx93a7ass.skadnetwork",
                "p78axxw29g.skadnetwork",
                "v72qych5uu.skadnetwork",
                "ludvb6z3bs.skadnetwork",
                "cp8zw746q7.skadnetwork",
                "3sh42y64q3.skadnetwork",
                "c6k4g5qg8m.skadnetwork",
                "s39g8k73mm.skadnetwork",
                "3qy4746246.skadnetwork",
                "f38h382jlk.skadnetwork",
                "hs6bdukanm.skadnetwork",
                "mlmmfzh3r3.skadnetwork",
                "v4nxqhlyqp.skadnetwork",
                "wzmmz9fp6w.skadnetwork",
                "su67r6k2v3.skadnetwork",
                "yclnxrl5pm.skadnetwork",
                "t38b2kh725.skadnetwork",
                "7ug5zh24hu.skadnetwork",
                "gta9lk7p23.skadnetwork",
                "vutu7akeur.skadnetwork",
                "y5ghdn5j9k.skadnetwork",
                "v9wttpbfk9.skadnetwork",
                "n38lu8286q.skadnetwork",
                "47vhws6wlr.skadnetwork",
                "kbd757ywx3.skadnetwork",
                "9t245vhmpl.skadnetwork",
                "a2p9lx4jpn.skadnetwork",
                "22mmun2rn5.skadnetwork",
                "44jx6755aq.skadnetwork",
                "k674qkevps.skadnetwork",
                "4468km3ulz.skadnetwork",
                "2u9pt9hc89.skadnetwork",
                "8s468mfl3y.skadnetwork",
                "klf5c3l5u5.skadnetwork",
                "ppxm28t8ap.skadnetwork",
                "kbmxgpxpgc.skadnetwork",
                "uw77j35x4d.skadnetwork",
                "578prtvx9j.skadnetwork",
                "4dzt52r2t5.skadnetwork",
                "tl55sbb4fm.skadnetwork",
                "c3frkrj4fj.skadnetwork",
                "e5fvkxwrpn.skadnetwork",
                "8c4e2ghe7u.skadnetwork",
                "3rd42ekr43.skadnetwork",
                "97r2b46745.skadnetwork",
                "3qcr597p9d.skadnetwork",
            ],
        },
    ]);
}


export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: "Elementle",
    slug: "mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/hamster-icon-blue.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: false,
    scheme: "elementle",
    backgroundColor: "#7DAAE8",
    splash: {
        image: "./assets/ui/Launch-Screen-Blue.png",
        backgroundColor: "#7DAAE8",
        resizeMode: "contain",
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
            "android.permission.ACCESS_COARSE_LOCATION",
            "android.permission.ACCESS_FINE_LOCATION",
        ],
        blockedPermissions: [
            "android.permission.RECORD_AUDIO",
            "android.permission.MODIFY_AUDIO_SETTINGS",
            "android.permission.CAMERA",
            "android.permission.READ_CONTACTS",
            "android.permission.WRITE_CONTACTS",
            "android.permission.CALL_PHONE",
            "android.permission.READ_PHONE_STATE",
            "android.permission.READ_CALENDAR",
            "android.permission.WRITE_CALENDAR",
            "android.permission.READ_EXTERNAL_STORAGE",
            "android.permission.WRITE_EXTERNAL_STORAGE",
        ],
        intentFilters: [
            {
                action: "VIEW",
                autoVerify: true,
                data: [
                    {
                        scheme: "https",
                        host: "elementle.tech",
                        pathPrefix: "/play/",
                    },
                    {
                        scheme: "https",
                        host: "www.elementle.tech",
                        pathPrefix: "/play/",
                    },
                ],
                category: ["BROWSABLE", "DEFAULT"],
            },
        ],
    },
    web: {
        favicon: "./assets/hamster-icon-blue.png",
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
