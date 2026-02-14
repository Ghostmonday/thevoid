#!/bin/bash
# Install Fated Fortress CLI

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SOURCE="$SCRIPT_DIR/fortress_cli.py"
INSTALL_DIR="$HOME/.local/bin"
BIN_PATH="$INSTALL_DIR/fortress"

echo "⚔ Installing Fated Fortress CLI..."

# Create install directory
mkdir -p "$INSTALL_DIR"

# Copy CLI
cp "$CLI_SOURCE" "$BIN_PATH"
chmod +x "$BIN_PATH"

# Add to PATH if not already there
SHELL_RC="$HOME/.bashrc"
if [ -f "$HOME/.zshrc" ]; then
    SHELL_RC="$HOME/.zshrc"
fi

if ! grep -q "$INSTALL_DIR" "$SHELL_RC" 2>/dev/null; then
    echo "" >> "$SHELL_RC"
    echo "# Fated Fortress CLI" >> "$SHELL_RC"
    echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$SHELL_RC"
    echo "✓ Added to PATH in $SHELL_RC"
    echo "  Run: source $SHELL_RC"
fi

echo ""
echo "✓ Installation complete!"
echo ""
echo "Usage:"
echo "  fortress status              Show fortress status"
echo "  fortress quests list        List all quests"
echo "  fortress squads list        List all squads"
echo "  fortress leaderboard        Show top builders"
echo "  fortress submit --quest-id Q-001 --content \"Your work\""
echo "  fortress verify --quest-id Q-001"
echo ""
echo "Run 'fortress --help' for more options"
echo ""
