module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            // Remove console logs only in production builds
            process.env.NODE_ENV === 'production' ? 'transform-remove-console' : null,
            "nativewind/babel",
            "react-native-reanimated/plugin"
        ].filter(Boolean),
    };
};