const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const { transformer, resolver } = config;

// SVG Transformer configuration
config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve("react-native-svg-transformer"),
};

// Remove 'json' and 'lottie' from sourceExts (so Metro doesn't try to compile them as JS)
config.resolver.sourceExts = config.resolver.sourceExts.filter(
    (ext) => ext !== 'lottie' && ext !== 'json'
);

// Add 'lottie' and 'json' to assetExts (so Metro treats them as static files)
config.resolver.assetExts.push("webp", "lottie", "json");

// Handle SVG as source (not asset)
config.resolver.sourceExts.push("svg");
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== "svg");

module.exports = config;
