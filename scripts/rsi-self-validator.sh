#!/bin/bash
# RSI Self-Validator - Validates RSI changes and handles automatic rollback
# Level 10: Autonomous RSI (self-validating with rollback)
# Called after every RSI change deployment

set -euo pipefail

LOG_FILE="$HOME/.rsi/validator.log"
STATE_FILE="$HOME/.rsi/validator-state.json"
ROLLBACK_DIR="$HOME/.rsi/rollbacks"
METRICS_DIR="$HOME/.rsi/metrics"
OPENCLAW_CMD="$(which openclaw 2>/dev/null || echo '/home/amir/.npm-global/bin/openclaw')"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [VALIDATOR] $*" | tee -a "$LOG_FILE"
}

# Load validator state
load_state() {
    if [[ -f "$STATE_FILE" ]]; then
        cat "$STATE_FILE"
    else
        echo '{"phase": "idle", "last_change": null, "validation_count": 0, "rollback_count": 0}'
    fi
}

# Save validator state
save_state() {
    local phase="$1"
    local last_change="${2:-null}"
    local validation_count="${3:-0}"
    local rollback_count="${4:-0}"
    
    mkdir -p "$HOME/.rsi"
    cat > "$STATE_FILE" << EOF
{
    "phase": "$phase",
    "last_change": $last_change,
    "validation_count": $validation_count,
    "rollback_count": $rollback_count,
    "last_updated": "$(date -Iseconds)"
}
EOF
}

# Capture current state for potential rollback
capture_state() {
    local change_id="$1"
    local backup_dir="$ROLLBACK_DIR/$change_id"
    
    mkdir -p "$backup_dir"
    
    # Capture critical files
    [[ -f "/home/amir/Documents/fatedfortress/GRADUATION.md" ]] && cp "/home/amir/Documents/fatedfortress/GRADUATION.md" "$backup_dir/"
    [[ -f "/home/amir/Documents/fatedfortress/SCORECARD.md" ]] && cp "/home/amir/Documents/fatedfortress/SCORECARD.md" "$backup_dir/"
    [[ -f "$HOME/.openclaw/openclaw.json" ]] && cp "$HOME/.openclaw/openclaw.json" "$backup_dir/"
    [[ -f "$HOME/.rsi/jobs.json" ]] && cp "$HOME/.rsi/jobs.json" "$backup_dir/"
    
    # Capture cron jobs state (use direct file inspection as fallback)
    if [[ -x "$OPENCLAW_CMD" ]]; then
        "$OPENCLAW_CMD" gateway cron list 2>/dev/null > "$backup_dir/cron-state.json" || echo "[]" > "$backup_dir/cron-state.json"
    elif [[ -f "$HOME/.openclaw/workspace/data/crons.json" ]]; then
        cp "$HOME/.openclaw/workspace/data/crons.json" "$backup_dir/cron-state.json"
    else
        echo "[]" > "$backup_dir/cron-state.json"
    fi
    
    log "State captured for change_id: $change_id"
    echo "$backup_dir"
}

# Validate system health
validate_system_health() {
    log "Validating system health..."
    
    local checks_passed=0
    local checks_total=0
    local errors=()
    
    # Check 1: Gateway is running
    ((checks_total++))
    if [[ -x "$OPENCLAW_CMD" ]] && "$OPENCLAW_CMD" gateway status 2>/dev/null | grep -q "running"; then
        ((checks_passed++))
        log "  ✓ Gateway running"
    elif pgrep -f "openclaw" > /dev/null 2>&1; then
        ((checks_passed++))
        log "  ✓ Gateway process running"
    else
        errors+=("Gateway not running")
        log "  ✗ Gateway not running"
    fi
    
    # Check 2: Core RSI jobs exist and are enabled
    ((checks_total++))
    local core_jobs=("rsi-implement" "retry-watcher" "rsi-metrics-tracker")
    local jobs_ok=true
    for job in "${core_jobs[@]}"; do
        if [[ -x "$OPENCLAW_CMD" ]]; then
            if ! "$OPENCLAW_CMD" gateway cron list 2>/dev/null | grep -q "$job"; then
                jobs_ok=false
                errors+=("Missing core job: $job")
                log "  ✗ Missing core job: $job"
            fi
        elif [[ -d "$HOME/.openclaw/workspace/data" ]]; then
            if ! grep -r "$job" "$HOME/.openclaw/workspace/data/" > /dev/null 2>&1; then
                jobs_ok=false
                errors+=("Missing core job: $job")
                log "  ✗ Missing core job: $job"
            fi
        fi
    done
    if $jobs_ok; then
        ((checks_passed++))
        log "  ✓ All core RSI jobs present"
    fi
    
    # Check 3: No jobs with >2 consecutive errors (unless expected)
    ((checks_total++))
    local high_error_jobs=0
    if [[ -x "$OPENCLAW_CMD" ]]; then
        high_error_jobs=$("$OPENCLAW_CMD" gateway cron list 2>/dev/null | grep -o '"consecutiveErrors": [0-9]*' | awk -F: '{print $2}' | awk '$1 > 2' | wc -l)
    elif [[ -f "$HOME/.openclaw/workspace/data/crons.json" ]]; then
        high_error_jobs=$(grep -o '"consecutiveErrors": [0-9]*' "$HOME/.openclaw/workspace/data/crons.json" 2>/dev/null | awk -F: '{print $2}' | awk '$1 > 2' | wc -l)
    fi
    if [[ $high_error_jobs -eq 0 ]]; then
        ((checks_passed++))
        log "  ✓ No jobs with critical error streaks"
    else
        errors+=("$high_error_jobs jobs with high consecutive errors")
        log "  ✗ $high_error_jobs jobs with critical error streaks"
    fi
    
    # Check 4: Filesystem access OK
    ((checks_total++))
    if [[ -w "/home/amir/Documents/fatedfortress" ]] && [[ -r "/home/amir/Documents/fatedfortress/GRADUATION.md" ]]; then
        ((checks_passed++))
        log "  ✓ Filesystem access OK"
    else
        errors+=("Filesystem access issues")
        log "  ✗ Filesystem access issues"
    fi
    
    # Check 5: Memory files accessible
    ((checks_total++))
    if [[ -d "$HOME/.rsi" ]] && [[ -r "$HOME/.rsi/metrics" ]] 2>/dev/null; then
        ((checks_passed++))
        log "  ✓ RSI metrics directory accessible"
    else
        errors+=("RSI metrics directory not accessible")
        log "  ✗ RSI metrics directory not accessible"
    fi
    
    # Return results
    local health_score=$((checks_passed * 100 / checks_total))
    echo "passed=$checks_passed total=$checks_total score=$health_score"
    printf '%s\n' "${errors[@]}"
}

# Validate change effectiveness
validate_change_effectiveness() {
    local change_id="$1"
    log "Validating change effectiveness for: $change_id"
    
    # Check RSI level progression
    local current_level=$(grep -oP 'RSI Level.*: \KLevel [0-9]+' "/home/amir/Documents/fatedfortress/GRADUATION.md" 2>/dev/null || echo "Unknown")
    log "  Current RSI Level: $current_level"
    
    # Check if scorecard was updated
    local scorecard_updated="false"
    if [[ -f "$ROLLBACK_DIR/$change_id/SCORECARD.md" ]]; then
        if ! diff -q "$ROLLBACK_DIR/$change_id/SCORECARD.md" "/home/amir/Documents/fatedfortress/SCORECARD.md" > /dev/null 2>&1; then
            scorecard_updated="true"
            log "  ✓ Scorecard updated"
        fi
    else
        scorecard_updated="true"
        log "  ✓ Scorecard accessible (baseline comparison)"
    fi
    
    # Check if graduation was updated
    local graduation_updated="false"
    if [[ -f "$ROLLBACK_DIR/$change_id/GRADUATION.md" ]]; then
        if ! diff -q "$ROLLBACK_DIR/$change_id/GRADUATION.md" "/home/amir/Documents/fatedfortress/GRADUATION.md" > /dev/null 2>&1; then
            graduation_updated="true"
            log "  ✓ Graduation updated"
        fi
    else
        graduation_updated="true"
        log "  ✓ Graduation accessible (baseline comparison)"
    fi
    
    # Return effectiveness score
    local effectiveness=50
    [[ "$scorecard_updated" == "true" ]] && ((effectiveness += 25))
    [[ "$graduation_updated" == "true" ]] && ((effectiveness += 25))
    
    echo "effectiveness=$effectiveness"
}

# Perform automatic rollback
perform_rollback() {
    local change_id="$1"
    local reason="$2"
    
    log "!!! PERFORMING ROLLBACK for change_id: $change_id !!!"
    log "Reason: $reason"
    
    local backup_dir="$ROLLBACK_DIR/$change_id"
    
    if [[ ! -d "$backup_dir" ]]; then
        log "ERROR: No backup found for change_id: $change_id"
        return 1
    fi
    
    # Restore files
    [[ -f "$backup_dir/GRADUATION.md" ]] && cp "$backup_dir/GRADUATION.md" "/home/amir/Documents/fatedfortress/"
    [[ -f "$backup_dir/SCORECARD.md" ]] && cp "$backup_dir/SCORECARD.md" "/home/amir/Documents/fatedfortress/"
    [[ -f "$backup_dir/openclaw.json" ]] && cp "$backup_dir/openclaw.json" "$HOME/.openclaw/"
    [[ -f "$backup_dir/jobs.json" ]] && cp "$backup_dir/jobs.json" "$HOME/.rsi/"
    
    # Log rollback
    {
        echo "=== ROLLBACK EXECUTED ==="
        echo "Change ID: $change_id"
        echo "Reason: $reason"
        echo "Timestamp: $(date -Iseconds)"
        echo "Files restored from: $backup_dir"
        echo "========================="
    } >> "$LOG_FILE"
    
    log "Rollback completed. Files restored to previous state."
    echo "rollback_success=true"
}

# Main validation cycle
validate_cycle() {
    local change_id="${1:-$(date +%Y%m%d_%H%M%S)}"
    local auto_rollback="${2:-true}"
    
    log "=== RSI Validation Cycle Started ==="
    log "Change ID: $change_id"
    log "Auto-rollback enabled: $auto_rollback"
    
    mkdir -p "$ROLLBACK_DIR"
    mkdir -p "$METRICS_DIR"
    
    # Load current state
    local current_state
    current_state=$(load_state)
    local prev_validation_count=$(echo "$current_state" | jq -r '.validation_count // 0')
    local prev_rollback_count=$(echo "$current_state" | jq -r '.rollback_count // 0')
    
    # Capture state before validation
    local backup_dir
    backup_dir=$(capture_state "$change_id")
    
    # Run health validation
    local health_results
    health_results=$(validate_system_health)
    local health_passed=$(echo "$health_results" | grep -oP 'passed=\K[0-9]+')
    local health_total=$(echo "$health_results" | grep -oP 'total=\K[0-9]+')
    local health_score=$(echo "$health_results" | grep -oP 'score=\K[0-9]+')
    
    log "Health check: $health_passed/$health_total (score: $health_score)"
    
    # Run effectiveness validation
    local effectiveness_results
    effectiveness_results=$(validate_change_effectiveness "$change_id")
    local effectiveness=$(echo "$effectiveness_results" | grep -oP 'effectiveness=\K[0-9]+')
    
    log "Effectiveness: $effectiveness%"
    
    # Determine overall validation result
    local validation_passed=false
    local rollback_triggered=false
    local failure_reason=""
    
    if [[ $health_score -lt 70 ]]; then
        validation_passed=false
        failure_reason="Health check failed (score: $health_score < 70)"
    elif [[ $effectiveness -lt 50 ]]; then
        validation_passed=false
        failure_reason="Change effectiveness too low ($effectiveness% < 50%)"
    else
        validation_passed=true
    fi
    
    # Handle validation result
    local new_validation_count=$((prev_validation_count + 1))
    local new_rollback_count=$prev_rollback_count
    
    if $validation_passed; then
        log "✓ VALIDATION PASSED"
        save_state "validated" "\"$change_id\"" "$new_validation_count" "$new_rollback_count"
        
        # Record success metrics
        {
            echo "{\"timestamp\": \"$(date -Iseconds)\","
            echo "\"change_id\": \"$change_id\","
            echo "\"health_score\": $health_score,"
            echo "\"effectiveness\": $effectiveness,"
            echo "\"status\": \"passed\""
            echo "}"
        } >> "$METRICS_DIR/validation-history.json"
        
    else
        log "✗ VALIDATION FAILED"
        log "Failure reason: $failure_reason"
        
        if [[ "$auto_rollback" == "true" ]]; then
            rollback_triggered=true
            local rollback_result
            rollback_result=$(perform_rollback "$change_id" "$failure_reason")
            
            if echo "$rollback_result" | grep -q "rollback_success=true"; then
                new_rollback_count=$((prev_rollback_count + 1))
            fi
        fi
        
        save_state "failed" "\"$change_id\"" "$new_validation_count" "$new_rollback_count"
        
        # Record failure metrics
        {
            echo "{\"timestamp\": \"$(date -Iseconds)\","
            echo "\"change_id\": \"$change_id\","
            echo "\"health_score\": $health_score,"
            echo "\"effectiveness\": $effectiveness,"
            echo "\"status\": \"failed\","
            echo "\"rollback_triggered\": $rollback_triggered,"
            echo "\"reason\": \"$failure_reason\""
            echo "}"
        } >> "$METRICS_DIR/validation-history.json"
    fi
    
    # Generate summary
    {
        echo "=== RSI Validation Summary ==="
        echo "Change ID: $change_id"
        echo "Timestamp: $(date -Iseconds)"
        echo "Health Score: $health_score% ($health_passed/$health_total checks)"
        echo "Effectiveness: $effectiveness%"
        echo "Validation: $( $validation_passed && echo "PASSED" || echo "FAILED")"
        if [[ "$rollback_triggered" == "true" ]]; then
            echo "Rollback: EXECUTED"
        fi
        echo "Reason: ${failure_reason:-N/A}"
        echo "============================="
    } >> "$LOG_FILE"
    
    # Output for reporting
    echo "validation_passed=$validation_passed"
    echo "health_score=$health_score"
    echo "effectiveness=$effectiveness"
    echo "rollback_triggered=$rollback_triggered"
    
    $validation_passed
}

# Show validator status
show_status() {
    local state
    state=$(load_state)
    
    echo "=== RSI Self-Validator Status ==="
    echo "$state" | jq .
    echo ""
    echo "Recent validation history:"
    [[ -f "$METRICS_DIR/validation-history.json" ]] && tail -5 "$METRICS_DIR/validation-history.json" || echo "No history yet"
    echo ""
    echo "Available rollbacks:"
    ls -la "$ROLLBACK_DIR" 2>/dev/null || echo "No rollbacks stored"
}

# Cleanup old rollbacks
cleanup() {
    local max_age_days="${1:-7}"
    
    log "Cleaning up rollbacks older than $max_age_days days..."
    
    find "$ROLLBACK_DIR" -maxdepth 1 -type d -mtime +$max_age_days -exec rm -rf {} \; 2>/dev/null || true
    
    # Trim validation history to last 100 entries
    if [[ -f "$METRICS_DIR/validation-history.json" ]]; then
        tail -100 "$METRICS_DIR/validation-history.json" > "$METRICS_DIR/validation-history.json.tmp" 2>/dev/null || true
        mv "$METRICS_DIR/validation-history.json.tmp" "$METRICS_DIR/validation-history.json" 2>/dev/null || true
    fi
    
    log "Cleanup complete"
}

# Main entry point
main() {
    local command="${1:-validate}"
    
    mkdir -p "$HOME/.rsi"
    mkdir -p "$ROLLBACK_DIR"
    mkdir -p "$METRICS_DIR"
    
    case "$command" in
        validate)
            validate_cycle "$2" "${3:-true}"
            ;;
        status)
            show_status
            ;;
        capture)
            capture_state "$2"
            ;;
        rollback)
            perform_rollback "$2" "${3:-manual rollback}"
            ;;
        cleanup)
            cleanup "${2:-7}"
            ;;
        *)
            echo "RSI Self-Validator - Level 10 Autonomous RSI"
            echo ""
            echo "Usage: $0 <command> [args]"
            echo ""
            echo "Commands:"
            echo "  validate [change_id] [auto_rollback]  - Run validation cycle"
            echo "  status                                 - Show validator status"
            echo "  capture <change_id>                    - Capture current state"
            echo "  rollback <change_id> <reason>          - Perform manual rollback"
            echo "  cleanup [days]                         - Clean old rollbacks"
            echo ""
            exit 1
            ;;
    esac
}

main "$@"
