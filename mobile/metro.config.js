const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const { transformer, resolver } = config;

// SVG Transformer configuration
config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve("react-native-svg-transformer"),
};

// Add lottie and webp to asset extensions
resolver.assetExts.push('lottie', 'webp');

// Remove lottie from source extensions (but KEEP json - it's needed for package.json etc)
resolver.sourceExts = resolver.sourceExts.filter(ext => ext !== 'lottie');

// Handle SVG as source (not asset)
resolver.sourceExts.push("svg");
resolver.assetExts = resolver.assetExts.filter((ext) => ext !== "svg");

module.exports = config;
