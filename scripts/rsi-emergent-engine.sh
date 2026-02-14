#!/bin/bash
# RSI Emergent Improvement Engine
# Self-discovers optimization opportunities from system behavior

set -euo pipefail

LOG_FILE="$HOME/.rsi/emergent-discoveries.log"
HYPOTHESES_FILE="$HOME/.rsi/emergent-hypotheses.json"
PREDICTIONS_DIR="$HOME/.rsi/predictions"
THRESHOLD_CONFIG="$HOME/.rsi/.rsi-threshold.conf"
MAX_HYPOTHESES=5
DISCOVERY_INTERVAL=86400  # Once per day

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

load_thresholds() {
    if [[ -f "$THRESHOLD_CONFIG" ]]; then
        source "$THRESHOLD_CONFIG"
    fi
    DISCOVERY_THRESHOLD=${DISCOVERY_THRESHOLD:-0.6}
}

# Scan prediction history for improvement opportunities
scan_prediction_patterns() {
    local opportunities=()
    
    if [[ -d "$PREDICTIONS_DIR" ]]; then
        # Find predictions that were correct but barely missed threshold
        for pred in "$PREDICTIONS_DIR"/*.md; do
            if [[ -f "$pred" ]]; then
                # Extract confidence and actual outcome
                local confidence actual
                confidence=$(grep -oP 'Confidence:\s*\K\d+' "$pred" 2>/dev/null || echo "0")
                
                # Look for optimization patterns
                if [[ $confidence -ge 60 ]] && [[ $confidence -lt 80 ]]; then
                    local job_name
                    job_name=$(basename "$pred" .md)
                    opportunities+=("improve-prediction-accuracy:$job_name:Boost $job_name prediction accuracy from ${confidence}%")
                fi
            fi
        done
    fi
    
    printf '%s\n' "${opportunities[@]}"
}

# Analyze cron job performance for patterns
analyze_job_patterns() {
    local opportunities=()
    
    # Check for jobs that recently failed
    if [[ -f "$HOME/.rsi/jobs.json" ]]; then
        # Look for jobs with error patterns
        local failed_jobs
        failed_jobs=$(grep -l "FAILED\|ERROR" "$HOME/.rsi"/*.log 2>/dev/null | head -5 || true)
        
        if [[ -n "$failed_jobs" ]]; then
            opportunities+=("analyze-failure-patterns:system:Identify root causes in recent failures")
        fi
    fi
    
    # Check if any strategy is underperforming
    opportunities+=("optimize-strategy-selection:system:Review API vs file operation success rates")
    
    printf '%s\n' "${opportunities[@]}"
}

# Generate autonomous hypotheses
generate_hypotheses() {
    local hypotheses_json="[]"
    local timestamp=$(date -Iseconds)
    
    # Collect all opportunities
    local all_opportunities=()
    while IFS= read -r line; do
        [[ -n "$line" ]] && all_opportunities+=("$line")
    done < <(scan_prediction_patterns)
    while IFS= read -r line; do
        [[ -n "$line" ]] && all_opportunities+=("$line")
    done < <(analyze_job_patterns)
    
    # Generate hypotheses from opportunities
    local hypotheses=()
    for opp in "${all_opportunities[@]:0:$MAX_HYPOTHESES}"; do
        IFS=':' read -r type target description <<< "$opp"
        
        local hypothesis_id="hyp-$(date +%s)-$$"
        local estimated_impact="medium"
        
        case "$type" in
            "improve-prediction-accuracy")
                estimated_impact="high"
                ;;
            "optimize-strategy-selection")
                estimated_impact="high"
                ;;
        esac
        
        # Build hypothesis JSON
        local hypothesis_json=$(cat <<EOF
{
    "id": "$hypothesis_id",
    "type": "$type",
    "target": "$target",
    "description": "$description",
    "estimated_impact": "$estimated_impact",
    "confidence": 0.7,
    "created_at": "$timestamp",
    "status": "pending"
}
EOF
)
        hypotheses+=("$hypothesis_json")
    done
    
    # Combine into array
    if [[ ${#hypotheses[@]} -gt 0 ]]; then
        hypotheses_json=$(printf '%s\n' "${hypotheses[@]}" | jq -s '.')
    fi
    
    echo "$hypotheses_json"
}

# Main discovery loop
main() {
    load_thresholds
    mkdir -p "$HOME/.rsi"
    
    log "=== Emergent Discovery Cycle Started ==="
    
    # Generate new hypotheses
    local new_hypotheses
    new_hypotheses=$(generate_hypotheses)
    
    if [[ "$new_hypotheses" != "[]" ]]; then
        # Merge with existing hypotheses
        if [[ -f "$HYPOTHESES_FILE" ]]; then
            local existing
            existing=$(cat "$HYPOTHESES_FILE")
            new_hypotheses=$(echo "$existing" "$new_hypotheses" | jq -s 'flatten | unique_by(.id)')
        fi
        
        echo "$new_hypotheses" > "$HYPOTHESES_FILE"
        
        local count
        count=$(echo "$new_hypotheses" | jq 'length')
        log "Generated $count new improvement hypotheses"
        
        # Show top opportunities
        echo "$new_hypotheses" | jq -r '.[] | "  - [\(.status)] \(.description) (impact: \(.estimated_impact))"' | head -10
    else
        log "No new improvement opportunities discovered"
        echo "  No new opportunities found this cycle"
    fi
    
    log "=== Emergent Discovery Cycle Complete ==="
}

main "$@"
