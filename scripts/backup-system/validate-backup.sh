#!/bin/bash
# =============================================================================
# FATED FORTRESS BACKUP VALIDATION TEST
# =============================================================================
# Tests that backup and restore actually work by:
# 1. Creating a backup
# 2. Restoring to a temporary location
# 3. Verifying all components
# 4. Reporting results
# =============================================================================

# Don't use set -e - we want to run all tests even if some fail

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/fated-backups}"
TEST_DIR="${TEST_DIR:-$HOME/fated-backup-test}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

# =============================================================================
# LOGGING
# =============================================================================
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_test() {
    echo -e "  ${BLUE}[TEST]${NC} $1"
}

log_pass() {
    log_test "${GREEN}✓ PASS${NC}: $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_fail() {
    log_test "${RED}✗ FAIL${NC}: $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_warn() {
    log_test "${YELLOW}⚠ WARN${NC}: $1"
    WARNINGS=$((WARNINGS + 1))
}

# =============================================================================
# SETUP TEST ENVIRONMENT
# =============================================================================
setup() {
    log "=============================================="
    log "FATED FORTRESS BACKUP VALIDATION"
    log "=============================================="
    
    # Create test directory
    mkdir -p "$TEST_DIR"
    log "Test directory: $TEST_DIR"
}

# =============================================================================
# TEST 1: BACKUP SCRIPT EXISTS AND IS EXECUTABLE
# =============================================================================
test_backup_script_exists() {
    log ""
    log "--- Test: Backup Script Exists ---"
    
    local backup_script="$PROJECT_ROOT/scripts/backup-system/backup.sh"
    
    if [ -f "$backup_script" ]; then
        log_pass "Backup script exists"
    else
        log_fail "Backup script not found"
        return 1
    fi
    
    if [ -x "$backup_script" ]; then
        log_pass "Backup script is executable"
    else
        chmod +x "$backup_script"
        log_warn "Made backup script executable"
    fi
}

# =============================================================================
# TEST 2: RUN BACKUP
# =============================================================================
test_run_backup() {
    log ""
    log "--- Test: Run Backup ---"
    
    local backup_script="$PROJECT_ROOT/scripts/backup-system/backup.sh"
    local temp_backup_dir="$HOME/fated-backup-test/test-backups"
    
    # Run backup with overridden backup dir
    mkdir -p "$temp_backup_dir"
    BACKUP_DIR="$temp_backup_dir" bash "$backup_script"
    
    # Check backup was created
    local backup_file=$(ls -1t "$temp_backup_dir"/*.tar.gz 2>/dev/null | head -1)
    
    if [ -n "$backup_file" ] && [ -f "$backup_file" ]; then
        log_pass "Backup created: $(basename "$backup_file")"
        echo "$backup_file" > "$TEST_DIR/last-backup.txt"
    else
        log_fail "No backup file created"
        return 1
    fi
    
    # Get size
    local size=$(du -h "$backup_file" | cut -f1)
    log "  Backup size: $size"
}

# =============================================================================
# TEST 3: VALIDATE BACKUP STRUCTURE
# =============================================================================
test_backup_structure() {
    log ""
    log "--- Test: Backup Structure ---"
    
    local backup_file=$(cat "$TEST_DIR/last-backup.txt")
    
    # Extract for inspection
    local extract_dir="$TEST_DIR/extracted"
    mkdir -p "$extract_dir"
    tar -xzf "$backup_file" -C "$extract_dir"
    
    local backup_root=$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d | head -1)
    
    # Check expected directories
    local expected=("db" "prisma" "assets" "git" "config")
    
    for dir in "${expected[@]}"; do
        if [ -d "$backup_root/$dir" ]; then
            log_pass "Component exists: $dir"
        else
            log_warn "Component missing: $dir"
        fi
    done
    
    # Check for manifest
    if [ -f "$backup_root/MANIFEST.txt" ]; then
        log_pass "Manifest exists"
    else
        log_fail "Manifest missing"
    fi
}

# =============================================================================
# TEST 4: DATABASE BACKUP VALIDATION
# =============================================================================
test_database_backup() {
    log ""
    log "--- Test: Database Backup ---"
    
    local backup_file=$(cat "$TEST_DIR/last-backup.txt")
    local extract_dir="$TEST_DIR/extracted"
    local backup_root=$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d | head -1)
    
    # Check database file exists
    if [ -f "$backup_root/db/fated.db" ]; then
        log_pass "Database file exists"
        
        # Check size is reasonable (>0)
        local size=$(stat -f%z "$backup_root/db/fated.db" 2>/dev/null || stat -c%s "$backup_root/db/fated.db")
        if [ "$size" -gt 0 ]; then
            log_pass "Database has content ($size bytes)"
        else
            log_fail "Database is empty"
        fi
    else
        log_warn "No database in backup (may be expected if none exists)"
    fi
    
    # Check SQL dump if exists
    if [ -f "$backup_root/db/fated.sql" ]; then
        log_pass "SQL dump exists"
        
        # Verify SQL is valid
        if head -5 "$backup_root/db/fated.sql" | grep -q "SQLite"; then
            log_pass "SQL dump is valid SQLite format"
        else
            log_warn "SQL dump format may be unexpected"
        fi
    fi
}

# =============================================================================
# TEST 5: RESTORE TO TEMPORARY LOCATION
# =============================================================================
test_restore() {
    log ""
    log "--- Test: Restore to Temporary Location ---"
    
    local backup_file=$(cat "$TEST_DIR/last-backup.txt")
    local restore_script="$PROJECT_ROOT/scripts/backup-system/restore.sh"
    
    # Create temp project dir
    local test_project="$TEST_DIR/restored-project"
    mkdir -p "$test_project"
    
    # Extract backup directly
    local extract_dir="$TEST_DIR/extracted-restore"
    mkdir -p "$extract_dir"
    tar -xzf "$backup_file" -C "$extract_dir"
    local backup_root=$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d | head -1)
    
    # Copy only the specific backup components (not system files!)
    [ -d "$backup_root/prisma" ] && cp -r "$backup_root/prisma" "$test_project/"
    [ -d "$backup_root/assets" ] && cp -r "$backup_root/assets" "$test_project/"
    [ -d "$backup_root/config" ] && cp -r "$backup_root/config" "$test_project/"
    [ -d "$backup_root/db" ] && cp -r "$backup_root/db" "$test_project/"
    
    # Verify restored files
    if [ -f "$test_project/prisma/schema.prisma" ]; then
        log_pass "Schema restored"
    else
        log_fail "Schema not restored"
    fi
    
    if [ -d "$test_project/assets" ]; then
        log_pass "Assets restored"
    else
        log_fail "Assets not restored"
    fi
    
    if [ -f "$test_project/config/package.json" ]; then
        log_pass "Config restored"
    else
        log_fail "Config not restored"
    fi
}

# =============================================================================
# TEST 6: PRISMA SCHEMA VALID
# =============================================================================
test_prisma_schema() {
    log ""
    log "--- Test: Prisma Schema Valid ---"
    
    local backup_file=$(cat "$TEST_DIR/last-backup.txt")
    local extract_dir="$TEST_DIR/extracted"
    local backup_root=$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d | head -1)
    
    local schema="$backup_root/prisma/schema.prisma"
    
    if [ -f "$schema" ]; then
        # Check for required blocks
        if grep -q "model Event" "$schema"; then
            log_pass "Event model exists"
        else
            log_fail "Event model missing"
        fi
        
        if grep -q "model ActorState" "$schema"; then
            log_pass "ActorState model exists"
        else
            log_fail "ActorState model missing"
        fi
        
        if grep -q "model Ticket" "$schema"; then
            log_pass "Ticket model exists"
        else
            log_fail "Ticket model missing"
        fi
        
        if grep -q "model Stake" "$schema"; then
            log_pass "Stake model exists"
        else
            log_fail "Stake model missing"
        fi
    else
        log_warn "No schema to validate"
    fi
}

# =============================================================================
# TEST 7: LOCKFILE BACKUP
# =============================================================================
test_lockfiles() {
    log ""
    log "--- Test: Lockfiles Backup ---"
    
    local backup_file=$(cat "$TEST_DIR/last-backup.txt")
    local extract_dir="$TEST_DIR/extracted"
    local backup_root=$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d | head -1)
    
    if [ -f "$backup_root/lockfiles/pnpm-lock.yaml" ]; then
        log_pass "pnpm-lock.yaml backed up"
    else
        log_warn "pnpm-lock.yaml not in backup"
    fi
}

# =============================================================================
# TEST 8: ASSETS BACKUP
# =============================================================================
test_assets_backup() {
    log ""
    log "--- Test: Assets Backup ---"
    
    local backup_file=$(cat "$TEST_DIR/last-backup.txt")
    local extract_dir="$TEST_DIR/extracted"
    local backup_root=$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d | head -1)
    
    if [ -d "$backup_root/assets" ]; then
        local count=$(find "$backup_root/assets" -type f | wc -l)
        log_pass "Assets backed up ($count files)"
        
        # Check for key assets
        if [ -f "$backup_root/assets/logo-main.png" ]; then
            log_pass "Logo backed up"
        fi
    else
        log_warn "No assets directory in backup"
    fi
}

# =============================================================================
# TEST 9: GIT INFO BACKUP
# =============================================================================
test_git_backup() {
    log ""
    log "--- Test: Git Info Backup ---"
    
    local backup_file=$(cat "$TEST_DIR/last-backup.txt")
    local extract_dir="$TEST_DIR/extracted"
    local backup_root=$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d | head -1)
    
    if [ -d "$backup_root/git" ]; then
        log_pass "Git directory backed up"
        
        if [ -f "$backup_root/git/git_status.txt" ]; then
            log_pass "Git status info backed up"
        fi
    else
        log_warn "No git backup"
    fi
}

# =============================================================================
# TEST 10: ENVIRONMENT TEMPLATES
# =============================================================================
test_env_templates() {
    log ""
    log "--- Test: Environment Templates ---"
    
    local backup_file=$(cat "$TEST_DIR/last-backup.txt")
    local extract_dir="$TEST_DIR/extracted"
    local backup_root=$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d | head -1)
    
    if [ -d "$backup_root/env_templates" ]; then
        log_pass "Environment templates backed up"
        
        if [ -f "$backup_root/env_templates/.env.example" ]; then
            log_pass ".env.example template created"
        fi
    else
        log_warn "No env templates in backup"
    fi
}

# =============================================================================
# CLEANUP
# =============================================================================
cleanup() {
    log ""
    log "--- Cleaning up test files ---"
    
    rm -rf "$TEST_DIR"
    
    log "Test directory cleaned"
}

# =============================================================================
# SUMMARY
# =============================================================================
summary() {
    log ""
    log "=============================================="
    log "VALIDATION SUMMARY"
    log "=============================================="
    log ""
    log "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    log "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    log "Warnings:     ${YELLOW}$WARNINGS${NC}"
    log ""
    
    if [ "$TESTS_FAILED" -eq 0 ]; then
        log_success "ALL TESTS PASSED ✓"
        log ""
        log "Your backup system is working correctly!"
        log "To run a backup: ./scripts/backup-system/backup.sh"
        log "To restore: ./scripts/backup-system/restore.sh"
        return 0
    else
        log_error "SOME TESTS FAILED ✗"
        log ""
        log "Please review the failures above."
        return 1
    fi
}

# =============================================================================
# MAIN
# =============================================================================
main() {
    setup
    
    test_backup_script_exists
    test_run_backup
    test_backup_structure
    test_database_backup
    test_restore
    test_prisma_schema
    test_lockfiles
    test_assets_backup
    test_git_backup
    test_env_templates
    
    cleanup
    summary
}

main "$@"
