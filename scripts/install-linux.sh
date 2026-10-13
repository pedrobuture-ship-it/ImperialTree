#!/usr/bin/env bash
# Builds Imperial Terminal and installs it for the current user:
#   ~/.local/bin/imperial-terminal, an icon, and a desktop entry, so it shows up
#   in the app launcher (Omarchy/Walker, GNOME, KDE, rofi, ...).
# Usage: scripts/install-linux.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if command -v mise >/dev/null 2>&1; then
  eval "$(mise env)"
fi
for tool in node npm cargo git; do
  command -v "$tool" >/dev/null 2>&1 || { echo "missing dependency: $tool (see README)" >&2; exit 1; }
done

npm install
npx tauri build --no-bundle

bin="$HOME/.local/bin"
apps="$HOME/.local/share/applications"
icons="$HOME/.local/share/icons/hicolor"
mkdir -p "$bin" "$apps"

install -Dm755 src-tauri/target/release/imperial-terminal "$bin/imperial-terminal"
install -Dm644 src-tauri/icons/32x32.png "$icons/32x32/apps/imperial-terminal.png"
install -Dm644 src-tauri/icons/128x128.png "$icons/128x128/apps/imperial-terminal.png"
install -Dm644 "src-tauri/icons/128x128@2x.png" "$icons/256x256/apps/imperial-terminal.png"

cat > "$apps/imperial-terminal.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Imperial Terminal
Comment=A Linux-first Git client that doesn't hide Git
Exec=$bin/imperial-terminal %f
Icon=imperial-terminal
Terminal=false
Categories=Development;RevisionControl;
Keywords=git;version control;commit;branch;worktree;rebase;
StartupWMClass=imperial-terminal
DESKTOP

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$apps" || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q "$icons" || true

echo "Installed. Launch it from your app launcher or run: imperial-terminal [path/to/repo]"
