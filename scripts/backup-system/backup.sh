#!/bin/bash
# =============================================================================
# FATED FORTRESS BACKUP SYSTEM
# =============================================================================
# Comprehensive backup for everything that could possibly fail:
# - Database (SQLite)
# - Prisma schema & migrations
# - Package lockfiles (reproducible builds)
# - Assets (logos, icons)
# - Git repository state
# - Configuration files
# =============================================================================

set -e

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/fated-backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="fated_backup_$TIMESTAMP"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =============================================================================
# LOGGING
# =============================================================================
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo -e "$msg"
    # Create backup dir first if needed
    mkdir -p "$BACKUP_DIR"
    echo "$msg" >> "$BACKUP_DIR/$BACKUP_NAME.log" 2>/dev/null || true
}

log_success() { log "${GREEN}✓ $1${NC}"; }
log_warn() { log "${YELLOW}⚠ $1${NC}"; }
log_error() { log "${RED}✗ $1${NC}"; }

# =============================================================================
# PRE-FLIGHT CHECKS
# =============================================================================
pre_flight() {
    log "=============================================="
    log "FATED FORTRESS BACKUP SYSTEM"
    log "=============================================="
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Check required files exist
    if [ ! -f "$PROJECT_ROOT/packages/db/prisma/fated.db" ]; then
        log_warn "Database not found at expected location - will create empty backup"
    fi
    
    # Check disk space
    local available=$(df -BG "$BACKUP_DIR" 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G')
    if [ -z "$available" ] || [ "$available" -lt 5 ]; then
        log_warn "Disk space check failed or low - continuing anyway"
    else
        log "  Available space: ${available}GB"
    fi
    
    log_success "Pre-flight checks passed"
}

# =============================================================================
# BACKUP DATABASE
# =============================================================================
backup_database() {
    log "--- Backing up Database ---"
    
    local db_source="$PROJECT_ROOT/packages/db/prisma/fated.db"
    local db_dest="$BACKUP_DIR/$BACKUP_NAME/db/fated.db"
    
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME/db"
    
    if [ -f "$db_source" ]; then
        # Copy database file
        cp "$db_source" "$db_dest"
        
        # Also export as SQL for portability
        if command -v sqlite3 &> /dev/null; then
            sqlite3 "$db_source" ".dump" > "$BACKUP_DIR/$BACKUP_NAME/db/fated.sql"
            log_success "Database backed up (SQLite + SQL dump)"
        else
            log_warn "sqlite3 not found - SQL dump skipped"
            cp "$db_source" "$db_dest"
            log_success "Database backed up (SQLite only)"
        fi
        
        # Get database stats
        local size=$(du -h "$db_dest" | cut -f1)
        log "  Database size: $size"
    else
        log_warn "Database file not found - skipping"
        touch "$BACKUP_DIR/$BACKUP_NAME/db/.empty"
    fi
}

# =============================================================================
# BACKUP PRISMA SCHEMA & MIGRATIONS
# =============================================================================
backup_prisma() {
    log "--- Backing up Prisma Schema & Migrations ---"
    
    local prisma_src="$PROJECT_ROOT/packages/db/prisma"
    local prisma_dest="$BACKUP_DIR/$BACKUP_NAME/prisma"
    
    mkdir -p "$prisma_dest"
    
    # Copy schema
    if [ -f "$prisma_src/schema.prisma" ]; then
        cp "$prisma_src/schema.prisma" "$prisma_dest/"
        log_success "Schema.prisma backed up"
    fi
    
    # Copy migrations
    if [ -d "$prisma_src/migrations" ]; then
        cp -r "$prisma_src/migrations" "$prisma_dest/"
        log_success "Migrations backed up ($(ls $prisma_src/migrations | wc -l) migrations)"
    fi
    
    # Copy seed files
    if [ -d "$prisma_src/seed" ]; then
        cp -r "$prisma_src/seed" "$prisma_dest/"
    fi
}

# =============================================================================
# BACKUP PACKAGE LOCKFILES
# =============================================================================
backup_lockfiles() {
    log "--- Backing up Package Lockfiles ---"
    
    local lock_dest="$BACKUP_DIR/$BACKUP_NAME/lockfiles"
    mkdir -p "$lock_dest"
    
    # pnpm lockfile
    if [ -f "$PROJECT_ROOT/pnpm-lock.yaml" ]; then
        cp "$PROJECT_ROOT/pnpm-lock.yaml" "$lock_dest/"
        log_success "pnpm-lock.yaml backed up"
    fi
    
    # Package-level lockfiles (some packages have their own)
    find "$PROJECT_ROOT/packages" -name "package-lock.json" -o -name "pnpm-lock.yaml" 2>/dev/null | while read -r lockfile; do
        local rel_path="${lockfile#$PROJECT_ROOT/}"
        local dest_path="$lock_dest/$rel_path"
        mkdir -p "$(dirname "$dest_path")"
        cp "$lockfile" "$dest_path"
    done
    
    log "  Lockfiles from $(find $lock_dest -name "*.yaml" -o -name "*.json" | wc -l) locations"
}

# =============================================================================
# BACKUP ASSETS
# =============================================================================
backup_assets() {
    log "--- Backing up Assets ---"
    
    local assets_src="$PROJECT_ROOT/assets"
    local assets_dest="$BACKUP_DIR/$BACKUP_NAME/assets"
    
    if [ -d "$assets_src" ]; then
        mkdir -p "$assets_dest"
        cp -r "$assets_src/"* "$assets_dest/"
        
        local count=$(find "$assets_dest" -type f | wc -l)
        log_success "Assets backed up ($count files)"
    else
        log_warn "Assets directory not found - skipping"
    fi
}

# =============================================================================
# BACKUP GIT REPOSITORY
# =============================================================================
backup_git() {
    log "--- Backing up Git Repository ---"
    
    local git_dest="$BACKUP_DIR/$BACKUP_NAME/git"
    mkdir -p "$git_dest"
    
    # Clone git repo (bare for smaller size)
    cd "$PROJECT_ROOT"
    git clone --bare . "$git_dest/fatedfortress.git" 2>/dev/null || {
        log_warn "Git clone failed - using git bundle instead"
        git bundle create "$git_dest/fatedfortress.bundle" --all 2>/dev/null || {
            log_warn "Git backup skipped - repository may be dirty"
            touch "$git_dest/.skipped"
            return
        }
    }
    
    # Also save git status info
    {
        echo "=== Git Status at Backup Time ==="
        echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
        echo "Commit: $(git rev-parse HEAD)"
        echo "Date: $(date)"
        echo ""
        echo "=== Uncommitted Changes ==="
        git status --porcelain
        echo ""
        echo "=== Recent Commits (last 10) ==="
        git log --oneline -10
    } > "$git_dest/git_status.txt"
    
    log_success "Git repository backed up"
}

# =============================================================================
# BACKUP CONFIG FILES
# =============================================================================
backup_config() {
    log "--- Backing up Configuration Files ---"
    
    local config_dest="$BACKUP_DIR/$BACKUP_NAME/config"
    mkdir -p "$config_dest"
    
    # Root config files
    local config_files=(
        "package.json"
        "tsconfig.json"
        "turbo.json"
        "pnpm-workspace.yaml"
        ".nvmrc"
    )
    
    for file in "${config_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            cp "$PROJECT_ROOT/$file" "$config_dest/"
        fi
    done
    
    # Package tsconfigs
    find "$PROJECT_ROOT/packages" -name "tsconfig.json" 2>/dev/null | head -10 | while read -r cfg; do
        local rel_path="${cfg#$PROJECT_ROOT/}"
        local dest_path="$config_dest/tsconfigs/${rel_path}"
        mkdir -p "$(dirname "$dest_path")"
        cp "$cfg" "$dest_path"
    done
    
    log_success "Configuration files backed up"
}

# =============================================================================
# BACKUP ENVIRONMENT TEMPLATES
# =============================================================================
backup_env_templates() {
    log "--- Backing up Environment Templates ---"
    
    local env_dest="$BACKUP_DIR/$BACKUP_NAME/env_templates"
    mkdir -p "$env_dest"
    
    # Look for .env.example or .env.template files
    find "$PROJECT_ROOT" -maxdepth 3 -name ".env.example" -o -name ".env.template" -o -name ".env.sample" 2>/dev/null | while read -r env_file; do
        local rel_path="${env_file#$PROJECT_ROOT/}"
        local dest_path="$env_dest/$rel_path"
        mkdir -p "$(dirname "$dest_path")"
        cp "$env_file" "$dest_path"
        log "  Found: $rel_path"
    done
    
    # Create a sample .env if none exist
    if [ ! -f "$env_dest/.env.example" ]; then
        cat > "$env_dest/.env.example" << 'EOF'
# Fated Fortress Environment Variables
# Copy this to .env and fill in your values

# Database
DATABASE_URL="file:./packages/db/prisma/fated.db"

# API Configuration
API_PORT=3000
API_HOST="0.0.0.0"

# Authentication
API_KEY="your-api-key-here"

# GitHub Webhook Secret
GITHUB_WEBHOOK_SECRET="your-webhook-secret"

# Redis (optional - for distributed locking)
REDIS_URL="redis://localhost:6379"

# Reaper Configuration
REAPER_INTERVAL_MS=300000
REAPER_ENABLED=true
REAPER_SLASH_PERCENT=0.5
EOF
        log "  Created .env.example template"
    fi
    
    log_success "Environment templates backed up"
}

# =============================================================================
# BACKUP DOCS (if any exist outside git)
# =============================================================================
backup_docs() {
    log "--- Backing up Documentation ---"
    
    local docs_src="$PROJECT_ROOT/docs"
    local docs_dest="$BACKUP_DIR/$BACKUP_NAME/docs"
    
    if [ -d "$docs_src" ]; then
        mkdir -p "$docs_dest"
        cp -r "$docs_src/"* "$docs_dest/" 2>/dev/null || true
        
        local count=$(find "$docs_dest" -type f 2>/dev/null | wc -l)
        log_success "Documentation backed up ($count files)"
    else
        log "  No docs directory found - skipping"
    fi
}

# =============================================================================
# CREATE MANIFEST
# =============================================================================
create_manifest() {
    log "--- Creating Backup Manifest ---"
    
    local manifest="$BACKUP_DIR/$BACKUP_NAME/MANIFEST.txt"
    
    cat > "$manifest" << EOF
================================================================================
FATED FORTRESS BACKUP MANIFEST
================================================================================
Backup Name: $BACKUP_NAME
Timestamp: $TIMESTAMP
Created: $(date)
Hostname: $(hostname)
User: $(whoami)

================================================================================
BACKUP CONTENTS
================================================================================

DATABASE:
$(ls -la "$BACKUP_DIR/$BACKUP_NAME/db/" 2>/dev/null | tail -n +4 || echo "  (empty)")

PRISMA:
$(ls -la "$BACKUP_DIR/$BACKUP_NAME/prisma/" 2>/dev/null | tail -n +4 || echo "  (empty)")

ASSETS:
$(ls -la "$BACKUP_DIR/$BACKUP_NAME/assets/" 2>/dev/null | tail -n +4 || echo "  (empty)")

GIT:
$(ls -la "$BACKUP_DIR/$BACKUP_NAME/git/" 2>/dev/null | tail -n +4 || echo "  (empty)")

CONFIG:
$(ls -la "$BACKUP_DIR/$BACKUP_NAME/config/" 2>/dev/null | tail -n +4 || echo "  (empty)")

================================================================================
SOURCE REPOSITORY INFO
================================================================================
Root: $PROJECT_ROOT
Git Branch: $(cd "$PROJECT_ROOT" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "N/A")
Git Commit: $(cd "$PROJECT_ROOT" && git rev-parse HEAD 2>/dev/null || echo "N/A")

================================================================================
BACKUP SIZE
================================================================================
$(du -sh "$BACKUP_DIR/$BACKUP_NAME")

================================================================================
EOF
    
    log_success "Manifest created"
}

# =============================================================================
# CREATE ARCHIVE
# =============================================================================
create_archive() {
    log "--- Creating Compressed Archive ---"
    
    local archive_name="$BACKUP_DIR/${BACKUP_NAME}.tar.gz"
    
    cd "$BACKUP_DIR"
    tar -czf "$archive_name" "$BACKUP_NAME"
    
    local size=$(du -h "$archive_name" | cut -f1)
    log_success "Archive created: $archive_name ($size)"
    
    # Remove uncompressed directory to save space
    rm -rf "$BACKUP_DIR/$BACKUP_NAME"
    
    log "  Backup complete: $archive_name"
}

# =============================================================================
# CLEANUP OLD BACKUPS
# =============================================================================
cleanup_old() {
    log "--- Cleaning up Old Backups ---"
    
    local max_backups=${MAX_BACKUPS:-10}
    
    # Keep .tar.gz files, remove oldest beyond max_backups
    local count=$(ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null | wc -l)
    
    if [ "$count" -gt "$max_backups" ]; then
        local to_delete=$((count - max_backups))
        ls -1t "$BACKUP_DIR"/*.tar.gz | tail -n +$((max_backups + 1)) | while read -r old_backup; do
            rm "$old_backup"
            log "  Removed old backup: $(basename "$old_backup")"
        done
        log_success "Cleanup complete (kept $max_backups most recent)"
    else
        log "  No cleanup needed ($count backups, max: $max_backups)"
    fi
}

# =============================================================================
# MAIN
# =============================================================================
main() {
    pre_flight
    backup_database
    backup_prisma
    backup_lockfiles
    backup_assets
    backup_git
    backup_config
    backup_env_templates
    backup_docs
    create_manifest
    create_archive
    cleanup_old
    
    log "=============================================="
    log_success "BACKUP COMPLETE"
    log "=============================================="
    log "Location: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
    log ""
    log "NEXT STEPS:"
    log "  1. Run validation: ./validate-backup.sh"
    log "  2. Store backup off-site for disaster recovery"
    log "=============================================="
}

main "$@"
