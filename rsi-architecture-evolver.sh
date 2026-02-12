#!/bin/bash
# rsi-architecture-evolver.sh - Level 11: Self-Evolving RSI
# Analyzes RSI architecture and implements evolutionary improvements

set -euo pipefail

METRICS_DIR="${HOME}/.rsi/metrics"
PARAM_FILE="${METRICS_DIR}/rsi-params.json"
ARCHIVE_DIR="${HOME}/.rsi/rollbacks"
PROPOSALS_DIR="${HOME}/.rsi/architecture-proposals"
LOG_FILE="${METRICS_DIR}/architecture-evolution.log"

mkdir -p "$ARCHIVE_DIR" "$PROPOSALS_DIR" "$METRICS_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

load_params() {
    if [[ -f "$PARAM_FILE" ]]; then
        cat "$PARAM_FILE"
    else
        echo '{"evolution_rate": 0.1, "min_confidence": 0.7, "max_changes_per_cycle": 3}'
    fi
}

save_params() {
    echo "$1" > "$PARAM_FILE"
}

analyze_performance() {
    local performance_score=0
    local issues=()

    # Check validation history
    if [[ -f "${METRICS_DIR}/validation-history.json" ]]; then
        local recent_validations
        recent_validations=$(tail -10 "$METRICS_DIR"/validation-history.json 2>/dev/null || echo "[]")
        local failed_count
        failed_count=$(echo "$recent_validations" | grep -c '"status":"failed"' || echo "0")
        failed_count=$(echo "$failed_count" | tr -d '[:space:]')
        
        if [[ $failed_count -gt 2 ]]; then
            performance_score=$((performance_score - 20))
            issues+=("high_failure_rate:$failed_count")
        else
            performance_score=$((performance_score + 20))
        fi
    fi

    # Check prediction accuracy
    if [[ -f "${METRICS_DIR}/predictions.json" ]]; then
        local predictions_count
        predictions_count=$(wc -l < "${METRICS_DIR}/predictions.json" 2>/dev/null || echo "0")
        if [[ $predictions_count -gt 5 ]]; then
            performance_score=$((performance_score + 15))
        fi
    fi

    # Check metrics completeness
    if [[ -f "${METRICS_DIR}/rsi-metrics.json" ]]; then
        local metrics_content
        metrics_content=$(cat "${METRICS_DIR}/rsi-metrics.json")
        if echo "$metrics_content" | grep -q "success_rate"; then
            performance_score=$((performance_score + 10))
        fi
        if echo "$metrics_content" | grep -q "velocity"; then
            performance_score=$((performance_score + 10))
        fi
    fi

    # Check hypothesis tracking
    if [[ -f "${HOME}/.rsi/emergent-hypotheses.json" ]]; then
        local hypothesis_count
        hypothesis_count=$(wc -l < "${HOME}/.rsi/emergent-hypotheses.json" 2>/dev/null || echo "0")
        if [[ $hypothesis_count -gt 0 ]]; then
            performance_score=$((performance_score + 15))
        fi
    fi

    # Check meta-learner activity
    if [[ -f "${METRICS_DIR}/meta-learner.json" ]]; then
        performance_score=$((performance_score + 20))
    fi

    echo "score:$performance_score|issues:${issues[*]:-none}"
}

generate_proposal() {
    local analysis="$1"
    local score
    score=$(echo "$analysis" | cut -d':' -f2 | cut -d'|' -f1)
    local issues
    issues=$(echo "$analysis" | cut -d'|' -f2 | cut -d':' -f2-)

    local proposal_id="proposal_$(date '+%Y%m%d_%H%M%S')"
    local proposal_file="${PROPOSALS_DIR}/${proposal_id}.json"
    
    # Generate proposals based on issues
    local changes=()
    local confidence=0.5

    if echo "$issues" | grep -q "high_failure_rate"; then
        changes+=('{"type": "parameter", "target": "retry_limit", "current": 3, "proposed": 5, "reason": "Increase retry limit to reduce failure rate"}')
        confidence=$(echo "$confidence + 0.1" | bc)
    fi

    # Check if cron jobs are optimal
    local job_count
    job_count=$(crontab -l 2>/dev/null | grep -c "rsi-" || echo "0")
    job_count=$(echo "$job_count" | tr -d '[:space:]')
    if [[ $job_count -lt 5 ]]; then
        changes+=('{"type": "capability", "action": "add_job", "job": "rsi-optimizer", "reason": "Additional optimization capability needed"}')
        confidence=$(echo "$confidence + 0.15" | bc)
    fi

    # Check parameter freshness
    local params_age
    if [[ -f "$PARAM_FILE" ]]; then
        params_age=$(($(date +%s) - $(date -r "$PARAM_FILE" +%s)))
        if [[ $params_age -gt 86400 ]]; then  # Older than 1 day
            changes+=('{"type": "parameter", "target": "evolution_rate", "action": "increase", "reason": "Parameters stale, increase evolution rate"}')
        fi
    fi

    cat > "$proposal_file" << EOF
{
    "id": "$proposal_id",
    "timestamp": "$(date -Iseconds)",
    "analysis_score": $score,
    "issues": "$issues",
    "confidence": $confidence,
    "changes": [$(IFS=,; echo "${changes[*]:-}")],
    "status": "pending"
}
EOF

    echo "$proposal_file"
}

implement_changes() {
    local proposal_file="$1"
    local proposal
    proposal=$(cat "$proposal_file")

    local confidence
    confidence=$(echo "$proposal" | grep -o '"confidence": [0-9.]*' | cut -d' ' -f2)
    local params
    params=$(load_params)
    local evolution_rate
    evolution_rate=$(echo "$params" | grep -o '"evolution_rate": [0-9.]*' | cut -d' ' -f2)

    # Only implement if confidence * evolution_rate > threshold
    local threshold=0.5
    local implementation_score
    implementation_score=$(echo "$confidence * $evolution_rate" | bc)
    implementation_score=$(echo "$implementation_score" | tr -d '\n')

    if echo "$implementation_score $threshold" | awk '{exit ($1 > $2 ? 0 : 1)}'; then
        log "Implementing proposal: $proposal_file (score: $implementation_score)"

        # Archive current state
        local archive_file="${ARCHIVE_DIR}/state_$(date '+%Y%m%d_%H%M%S').tar.gz"
        tar -czf "$archive_file" "${HOME}/.rsi/" 2>/dev/null || true

        # Extract and apply changes
        echo "$proposal" | grep -o '"changes": \[[^]]*\]' | sed 's/,/\n/g' | while read -r change; do
            if echo "$change" | grep -q '"type": "parameter"'; then
                local target
                target=$(echo "$change" | grep -o '"target": "[^"]*"' | cut -d'"' -f4)
                local proposed
                proposed=$(echo "$change" | grep -o '"proposed": [0-9]*' | cut -d' ' -f2)
                
                if [[ -n "$target" && -n "$proposed" ]]; then
                    log "Evolving parameter: $target -> $proposed"
                    # Update params JSON
                    params=$(echo "$params" | sed "s/\"$target\": [0-9.]*/\"$target\": $proposed/")
                fi
            elif echo "$change" | grep -q '"type": "capability"'; then
                local action
                action=$(echo "$change" | grep -o '"action": "[^"]*"' | cut -d'"' -f4)
                local job
                job=$(echo "$change" | grep -o '"job": "[^"]*"' | cut -d'"' -f4)
                
                if [[ "$action" == "add_job" && -n "$job" ]]; then
                    log "Adding capability: $job"
                    # Would create new RSI capability here
                fi
            fi
        done

        save_params "$params"
        
        # Update proposal status
        sed -i 's/"status": "pending"/"status": "implemented"/' "$proposal_file"
        sed -i "s/\"implemented\": \".*\"/\"implemented\": \"$(date -Iseconds)\"/" "$proposal_file"
        
        log "Proposal implemented successfully"
        return 0
    else
        log "Proposal confidence too low: $implementation_score < $threshold"
        sed -i 's/"status": "pending"/"status": "rejected"/' "$proposal_file"
        return 1
    fi
}

assess_capability_needs() {
    local needs=()
    
    # Check for missing capabilities
    if ! crontab -l 2>/dev/null | grep -q "rsi-meta-learner"; then
        needs+=("meta_learning")
    fi
    if ! crontab -l 2>/dev/null | grep -q "rsi-self-validator"; then
        needs+=("self_validation")
    fi
    if ! crontab -l 2>/dev/null | grep -q "rsi-architecture"; then
        needs+=("architecture_evolution")
    fi
    
    echo "${needs[*]:-none}"
}

main() {
    log "=== Architecture Evolution Cycle Started ==="
    
    # Step 1: Analyze current performance
    local analysis
    analysis=$(analyze_performance)
    log "Performance analysis: $analysis"
    
    # Step 2: Assess capability needs
    local needs
    needs=$(assess_capability_needs)
    log "Capability needs: $needs"
    
    # Step 3: Generate proposal if needed
    local score
    score=$(echo "$analysis" | cut -d':' -f2 | cut -d'|' -f1)
    
    if [[ $score -lt 80 ]]; then
        log "Performance score $score < 80, generating proposal..."
        local proposal_file
        proposal_file=$(generate_proposal "$analysis")
        log "Proposal generated: $proposal_file"
        
        # Step 4: Implement if confident
        if implement_changes "$proposal_file"; then
            log "Changes implemented successfully"
        else
            log "Changes not implemented (confidence threshold not met)"
        fi
    else
        log "Performance score $score >= 80, no changes needed"
    fi
    
    # Step 5: Evolve parameters based on effectiveness
    local params
    params=$(load_params)
    local current_evolution
    current_evolution=$(echo "$params" | grep -o '"evolution_rate": [0-9.]*' | cut -d' ' -f2)
    
    # Slowly increase evolution rate if stable
    if echo "$score" | awk '{exit ($1 > 70 ? 0 : 1)}'; then
        local new_evolution
        new_evolution=$(echo "$current_evolution + 0.05" | bc)
        if echo "$new_evolution" | awk '{exit ($1 < 0.5 ? 0 : 1)}'; then
            params=$(echo "$params" | sed "s/\"evolution_rate\": $current_evolution/\"evolution_rate\": $new_evolution/")
            save_params "$params"
            log "Evolved evolution_rate: $current_evolution -> $new_evolution"
        fi
    fi
    
    log "=== Architecture Evolution Cycle Complete ==="
}

main "$@"
