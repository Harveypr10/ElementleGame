const { getDefaultConfig } = require("expo/metro-config");

module.exports = (() => {
    const config = getDefaultConfig(__dirname);

    const { transformer, resolver } = config;

    config.transformer = {
        ...transformer,
        babelTransformerPath: require.resolve("react-native-svg-transformer"),
    };
    config.resolver.assetExts.push("webp", "lottie");
    config.resolver.sourceExts.push("svg");
    config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== "svg");




    return config;
})();
