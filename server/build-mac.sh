#!/bin/bash

# --- Configuration ---
APP_NAME="TableTalk"
ICON_FILE="assets/icon.icns"
DIST_DIR="release" # Directory where the final .app will be placed

# Define names for the architecture-specific executables
X64_EXEC_NAME="table-talk-server-x64"
ARM64_EXEC_NAME="table-talk-server-arm64"
UNIVERSAL_EXEC_NAME="table-talk-server-macos" # This will be the final executable name inside the .app

# --- Script Start ---
echo "Starting Universal macOS build process..."

# 1. Clean up old builds and ensure the distribution directory exists
rm -f "$DIST_DIR/$X64_EXEC_NAME" "$DIST_DIR/$ARM64_EXEC_NAME"
mkdir -p $DIST_DIR

# 2. Build for Intel (x64)
echo "Building for Intel (x64)..."
pkg . --targets node18-macos-x64 --output "$DIST_DIR/$X64_EXEC_NAME"
if [ $? -ne 0 ]; then echo "Error: pkg failed for x64 build."; exit 1; fi

# 3. Build for Apple Silicon (arm64)
echo "Building for Apple Silicon (arm64)..."
pkg . --targets node18-macos-arm64 --output "$DIST_DIR/$ARM64_EXEC_NAME"
if [ $? -ne 0 ]; then echo "Error: pkg failed for arm64 build."; exit 1; fi

# 4. Combine into a Universal binary using lipo
echo "Creating Universal binary with lipo..."
lipo -create -output "$DIST_DIR/$UNIVERSAL_EXEC_NAME" "$DIST_DIR/$X64_EXEC_NAME" "$DIST_DIR/$ARM64_EXEC_NAME"
if [ $? -ne 0 ]; then echo "Error: lipo failed to create Universal binary."; exit 1; fi

# 5. Create the .app bundle structure
echo "Creating .app bundle..."
APP_BUNDLE_PATH="$DIST_DIR/$APP_NAME.app"
CONTENTS_PATH="$APP_BUNDLE_PATH/Contents"
MACOS_PATH="$CONTENTS_PATH/MacOS"
RESOURCES_PATH="$CONTENTS_PATH/Resources"

rm -rf "$APP_BUNDLE_PATH" # Clean up old .app bundle
mkdir -p $MACOS_PATH
mkdir -p $RESOURCES_PATH

# 6. Copy the Universal executable, set permissions, and add the icon
echo "Copying files and setting permissions..."
# Copy the executable
cp "$DIST_DIR/$UNIVERSAL_EXEC_NAME" "$MACOS_PATH/"
# Make the binary executable
chmod +x "$MACOS_PATH/$UNIVERSAL_EXEC_NAME"
# Copy the icon
cp "$ICON_FILE" "$RESOURCES_PATH/"

# 7. Create the Info.plist file
PLIST_PATH="$CONTENTS_PATH/Info.plist"
cat > "$PLIST_PATH" <<EOL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>${UNIVERSAL_EXEC_NAME}</string>
    <key>CFBundleIconFile</key>
    <string>icon.icns</string>
    <key>CFBundleIdentifier</key>
    <string>com.yourcompany.tabletalk</string>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
</dict>
</plist>
EOL

# 8. Clean up the intermediate executable files
rm "$DIST_DIR/$X64_EXEC_NAME" "$DIST_DIR/$ARM64_EXEC_NAME"

echo "✅ Universal build complete! Find your app at: $APP_BUNDLE_PATH"