#!/bin/bash
# Run iOS simulator with noisy system-level warnings filtered out.
# These are harmless simulator-only logs that clutter the console.

npx expo run:ios 2>&1 | grep -v \
  -e 'CGBitmapContextInfoCreate' \
  -e 'requires floating point or CIF10 bitmap context' \
  -e 'LoudnessManager' \
  -e 'FigFilePlayer' \
  -e 'BrowserEngineKit' \
  -e 'Failed to terminate process' \
  -e 'extensionKit.errorDomain' \
  -e 'RBSRequestErrorDomain' \
  -e 'No such process found' \
  -e 'plist loaded, returning false'
