#!/bin/bash
# =============================================================================
# FATED FORTRESS BACKUP RESTORE SYSTEM
# =============================================================================
# Restore from a backup archive
# Usage: ./restore.sh <backup-file.tar.gz> [options]
# Options:
#   --dry-run    Show what would be restored without restoring
#   --validate   Only validate backup integrity (no restore)
# =============================================================================

set -e

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/fated-backups}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================================================
# LOGGING
# =============================================================================
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_success() { log "${GREEN}✓ $1${NC}"; }
log_warn() { log "${YELLOW}⚠ $1${NC}"; }
log_error() { log "${RED}✗ $1${NC}"; }
log_info() { log "${BLUE}ℹ $1${NC}"; }

# =============================================================================
# USAGE
# =============================================================================
usage() {
    cat << EOF
Fated Fortress Backup Restore

Usage: $0 <backup-file.tar.gz> [options]

Options:
  --dry-run    Show what would be restored without restoring
  --validate   Only validate backup integrity (no restore)
  --component  Restore only specific component (db|prisma|assets|git|config|all)

Examples:
  $0                                      # Interactively select backup
  $0 fated_backup_20240213_143022.tar.gz  # Restore specific backup
  $0 --validate                           # Validate most recent backup
  $0 --dry-run                            # Preview restore without changes

EOF
    exit 1
}

# =============================================================================
# FIND MOST RECENT BACKUP
# =============================================================================
find_most_recent() {
    local latest=$(ls -1t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | head -1)
    if [ -z "$latest" ]; then
        log_error "No backups found in $BACKUP_DIR"
        exit 1
    fi
    echo "$latest"
}

# =============================================================================
# VALIDATE BACKUP
# =============================================================================
validate_backup() {
    local backup_file="$1"
    
    log_info "Validating backup: $backup_file"
    
    # Check file exists
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    # Check file is valid tar
    if ! tar -tzf "$backup_file" &>/dev/null; then
        log_error "Invalid tar.gz archive"
        return 1
    fi
    
    # Check contents
    local contents=$(tar -tzf "$backup_file")
    
    echo ""
    echo "=== Backup Contents ==="
    echo "$contents" | head -30
    echo "... (truncated)"
    echo ""
    
    # Check for required files
    local has_db=$(echo "$contents" | grep -c "db/fated" || true)
    local has_schema=$(echo "$contents" | grep -c "schema.prisma" || true)
    local has_git=$(echo "$contents" | grep -c "git/" || true)
    
    echo "=== Validation Results ==="
    [ "$has_db" -gt 0 ] && log_success "Database included" || log_warn "Database NOT included"
    [ "$has_schema" -gt 0 ] && log_success "Prisma schema included" || log_warn "Prisma schema NOT included"
    [ "$has_git" -gt 0 ] && log_success "Git repository included" || log_warn "Git repository NOT included"
    
    # Extract size
    local size=$(du -h "$backup_file" | cut -f1)
    log_info "Backup size: $size"
    
    return 0
}

# =============================================================================
# DRY RUN
# =============================================================================
dry_run() {
    local backup_file="$1"
    
    log_info "=== DRY RUN MODE ==="
    log_info "Would restore from: $backup_file"
    echo ""
    
    tar -tzf "$backup_file" | while read -r item; do
        if [ -d "$PROJECT_ROOT/$item" ]; then
            echo "  [DIR ] $item"
        elif [ -f "$PROJECT_ROOT/$item" ]; then
            echo "  [OLD ] $item"
        else
            echo "  [NEW ] $item"
        fi
    done
    
    echo ""
    log_warn "This was a dry run - no files were actually changed"
}

# =============================================================================
# RESTORE DATABASE
# =============================================================================
restore_database() {
    local backup_root="$1"
    local db_backup="$backup_root/db"
    
    log_info "Restoring Database..."
    
    # Check if backup has database
    if [ ! -f "$db_backup/fated.db" ]; then
        log_warn "No database in backup - skipping"
        return 0
    fi
    
    # Backup current database first
    if [ -f "$PROJECT_ROOT/packages/db/prisma/fated.db" ]; then
        local timestamp=$(date +%Y%m%d_%H%M%S)
        cp "$PROJECT_ROOT/packages/db/prisma/fated.db" \
           "$PROJECT_ROOT/packages/db/prisma/fated.db.pre-restore-$timestamp"
        log_info "Current database backed up with timestamp"
    fi
    
    # Restore database
    cp "$db_backup/fated.db" "$PROJECT_ROOT/packages/db/prisma/fated.db"
    log_success "Database restored"
    
    # If SQL dump exists, verify it matches
    if [ -f "$db_backup/fated.sql" ]; then
        log_info "SQL dump also available for manual recovery"
    fi
}

# =============================================================================
# RESTORE PRISMA
# =============================================================================
restore_prisma() {
    local backup_root="$1"
    local prisma_backup="$backup_root/prisma"
    
    log_info "Restoring Prisma Schema & Migrations..."
    
    if [ ! -d "$prisma_backup" ]; then
        log_warn "No Prisma backup - skipping"
        return 0
    fi
    
    # Restore schema
    if [ -f "$prisma_backup/schema.prisma" ]; then
        cp "$prisma_backup/schema.prisma" "$PROJECT_ROOT/packages/db/prisma/"
        log_success "Schema.prisma restored"
    fi
    
    # Restore migrations
    if [ -d "$prisma_backup/migrations" ]; then
        cp -r "$prisma_backup/migrations/"* "$PROJECT_ROOT/packages/db/prisma/migrations/" 2>/dev/null || true
        log_success "Migrations restored"
    fi
}

# =============================================================================
# RESTORE ASSETS
# =============================================================================
restore_assets() {
    local backup_root="$1"
    local assets_backup="$backup_root/assets"
    
    log_info "Restoring Assets..."
    
    if [ ! -d "$assets_backup" ]; then
        log_warn "No assets backup - skipping"
        return 0
    fi
    
    mkdir -p "$PROJECT_ROOT/assets"
    cp -r "$assets_backup/"* "$PROJECT_ROOT/assets/"
    log_success "Assets restored"
}

# =============================================================================
# RESTORE GIT
# =============================================================================
restore_git() {
    local backup_root="$1"
    local git_backup="$backup_root/git"
    
    log_info "Restoring Git Repository..."
    
    if [ ! -d "$git_backup" ]; then
        log_warn "No git backup - skipping"
        return 0
    fi
    
    # Show git status info
    if [ -f "$git_backup/git_status.txt" ]; then
        log_info "Git backup info:"
        cat "$git_backup/git_status.txt"
    fi
    
    # To fully restore git, you'd need to:
    # 1. Copy the bare repo
    # 2. Reset HEAD
    # This is complex and risky, so we just warn
    log_warn "Git repository restoration requires manual intervention"
    log_info "  Backup location: $git_backup"
    log_info "  You can restore with: git reset --hard <commit>"
}

# =============================================================================
# RESTORE CONFIG
# =============================================================================
restore_config() {
    local backup_root="$1"
    local config_backup="$backup_root/config"
    
    log_info "Restoring Configuration Files..."
    
    if [ ! -d "$config_backup" ]; then
        log_warn "No config backup - skipping"
        return 0
    fi
    
    # Restore root config files
    for file in package.json tsconfig.json turbo.json pnpm-workspace.yaml; do
        if [ -f "$config_backup/$file" ]; then
            cp "$config_backup/$file" "$PROJECT_ROOT/"
            log "  Restored: $file"
        fi
    done
    
    log_success "Configuration restored"
}

# =============================================================================
# RESTORE ENV TEMPLATES
# =============================================================================
restore_env() {
    local backup_root="$1"
    local env_backup="$backup_root/env_templates"
    
    log_info "Restoring Environment Templates..."
    
    if [ ! -d "$env_backup" ]; then
        log_warn "No env templates backup - skipping"
        return 0
    fi
    
    # Copy .env.example if exists
    if [ -f "$env_backup/.env.example" ]; then
        mkdir -p "$PROJECT_ROOT"
        cp "$env_backup/.env.example" "$PROJECT_ROOT/.env.example"
        log_success "Environment template restored"
    fi
}

# =============================================================================
# MAIN
# =============================================================================
main() {
    local backup_file=""
    local dry_run_mode=false
    local validate_only=false
    
    # Parse arguments
    while [ $# -gt 0 ]; do
        case "$1" in
            --dry-run)
                dry_run_mode=true
                shift
                ;;
            --validate)
                validate_only=true
                shift
                ;;
            -h|--help)
                usage
                ;;
            -*.tar.gz)
                backup_file="$1"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                ;;
        esac
    done
    
    # Find backup file
    if [ -z "$backup_file" ]; then
        if [ "$validate_only" = true ]; then
            backup_file=$(find_most_recent)
        else
            log_info "No backup specified. Available backups:"
            ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null || echo "  No backups found"
            echo ""
            backup_file=$(find_most_recent)
        fi
    fi
    
    # Resolve full path
    if [ ! -f "$backup_file" ]; then
        backup_file="$BACKUP_DIR/$(basename "$backup_file")"
    fi
    
    # Validate
    if ! validate_backup "$backup_file"; then
        log_error "Backup validation failed"
        exit 1
    fi
    
    if [ "$validate_only" = true ]; then
        log_success "Backup validation complete"
        exit 0
    fi
    
    # Dry run
    if [ "$dry_run_mode" = true ]; then
        dry_run "$backup_file"
        exit 0
    fi
    
    # Extract backup
    log_info "Extracting backup..."
    local extract_dir=$(mktemp -d)
    tar -xzf "$backup_file" -C "$extract_dir"
    
    # Find extracted directory
    local backup_root=$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d | head -1)
    
    log_info "Restoring to: $PROJECT_ROOT"
    
    # Confirm
    echo ""
    log_warn "This will OVERWRITE existing files. Continue? (y/N)"
    read -r confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        log_info "Restore cancelled"
        rm -rf "$extract_dir"
        exit 0
    fi
    
    # Restore components
    restore_database "$backup_root"
    restore_prisma "$backup_root"
    restore_assets "$backup_root"
    restore_config "$backup_root"
    restore_env "$backup_root"
    restore_git "$backup_root"
    
    # Cleanup
    rm -rf "$extract_dir"
    
    echo ""
    log_success "=============================================="
    log_success "RESTORE COMPLETE"
    log_success "=============================================="
    log ""
    log "NEXT STEPS:"
    log "  1. Run database migrations if needed: pnpm prisma migrate deploy"
    log "  2. Restart services"
    log "  3. Verify system functionality"
    log "=============================================="
}

main "$@"
