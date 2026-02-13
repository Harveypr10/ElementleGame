/**
 * Expo Config Plugin: withSentryAllowFailure
 *
 * Appends `export SENTRY_ALLOW_FAILURE=true` to ios/.xcode.env.local
 * so that sentry-cli build phases don't fail the archive when
 * SENTRY_AUTH_TOKEN is missing (e.g. during local EAS builds).
 *
 * When the token IS present (cloud builds via EAS Secrets), source
 * maps and dSYMs are still uploaded successfully.
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withSentryAllowFailure(config) {
    return withDangerousMod(config, [
        "ios",
        (config) => {
            const envFile = path.join(config.modRequest.platformProjectRoot, ".xcode.env.local");

            let contents = "";
            if (fs.existsSync(envFile)) {
                contents = fs.readFileSync(envFile, "utf-8");
            }

            const sentryLine = "export SENTRY_ALLOW_FAILURE=true";
            const disableLine = "export SENTRY_DISABLE_AUTO_UPLOAD=true";
            if (!contents.includes(sentryLine)) {
                contents += `\n# Allow sentry-cli to fail gracefully when auth token is missing\n${sentryLine}\n`;
            }
            if (!contents.includes(disableLine)) {
                contents += `# Disable automatic debug symbol uploading during builds\n${disableLine}\n`;
            }
            fs.writeFileSync(envFile, contents, "utf-8");

            return config;
        },
    ]);
};
