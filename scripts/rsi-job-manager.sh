#!/bin/bash
# RSI Job Manager - Direct file manipulation fallback for API timeouts
# Part of Level 5 RSI Self-Healing capability

set -e

JOBS_FILE="/home/amir/.openclaw/workspace/data/jobs.json"
PREDICTIONS_FILE="/home/amir/Documents/fatedfortress/memory/rsi-predictions.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[RSI-JOB-MGR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[RSI-JOB-MGR]${NC} $1"
}

log_error() {
    echo -e "${RED}[RSI-JOB-MGR]${NC} $1"
}

# Function: Analyze job states and generate predictions
analyze_and_predict() {
    log_info "Analyzing job states from $JOBS_FILE..."

    if [ ! -f "$JOBS_FILE" ]; then
        log_error "Jobs file not found: $JOBS_FILE"
        exit 1
    fi

    # Extract job data and analyze
    local at_risk_count=0
    local high_confidence_count=0
    local preventive_actions=0

    # Parse jobs.json using jq (or python as fallback)
    if command -v jq &> /dev/null; then
        # Use jq for parsing
        local jobs_json=$(cat "$JOBS_FILE")
        local job_count=$(echo "$jobs_json" | jq '. | length')

        log_info "Found $job_count jobs to analyze"

        # Analyze each job
        echo "$jobs_json" | jq -c '.[]' | while read -r job; do
            local name=$(echo "$job" | jq -r '.name')
            local id=$(echo "$job" | jq -r '.id')
            local consecutive_errors=$(echo "$job" | jq -r '.state.consecutiveErrors // 0')
            local last_error=$(echo "$job" | jq -r '.state.lastError // "none"')
            local last_status=$(echo "$job" | jq -r '.state.lastStatus // "unknown"')
            local enabled=$(echo "$job" | jq -r '.enabled')

            # Risk assessment
            local risk_level="LOW"
            local confidence=0
            local prediction_window=0
            local factors=""
            local action=""

            if [ "$enabled" = "true" ]; then
                if [ "$consecutive_errors" -ge 3 ]; then
                    risk_level="CRITICAL"
                    confidence=95
                    prediction_window=1
                    factors="consecutiveErrors=$consecutive_errors, lastError='$last_error'"
                    action="Immediate retry required - job stuck"
                    preventive_actions=$((preventive_actions + 1))
                elif [ "$consecutive_errors" -ge 2 ]; then
                    risk_level="HIGH"
                    confidence=80
                    prediction_window=2
                    factors="consecutiveErrors=$consecutive_errors trending up"
                    action="Schedule preventive retry"
                elif [ "$consecutive_errors" -ge 1 ]; then
                    risk_level="MEDIUM"
                    confidence=60
                    prediction_window=3
                    factors="consecutiveErrors=$consecutive_errors, lastStatus='$last_status'"
                    action="Monitor closely"
                fi

                if [ "$risk_level" != "LOW" ]; then
                    at_risk_count=$((at_risk_count + 1))
                    if [ "$confidence" -ge 80 ]; then
                        high_confidence_count=$((high_confidence_count + 1))
                    fi

                    # Generate prediction entry
                    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
                    local prediction_id="pred-$(echo "$id" | cut -c1-8)-$(date +%s)"

                    echo "## Prediction: $prediction_id" >> "$PREDICTIONS_FILE"
                    echo "- **Job**: $name ($id)" >> "$PREDICTIONS_FILE"
                    echo "- **Risk Level**: $risk_level" >> "$PREDICTIONS_FILE"
                    echo "- **Confidence**: $confidence%" >> "$PREDICTIONS_FILE"
                    echo "- **Prediction Window**: Next $prediction_window cycle(s)" >> "$PREDICTIONS_FILE"
                    echo "- **Triggering Factors**: $factors" >> "$PREDICTIONS_FILE"
                    echo "- **Recommended Action**: $action" >> "$PREDICTIONS_FILE"
                    echo "- **Status**: PENDING" >> "$PREDICTIONS_FILE"
                    echo "- **Created**: $timestamp" >> "$PREDICTIONS_FILE"
                    echo "" >> "$PREDICTIONS_FILE"

                    log_info "Prediction created: $name (Risk: $risk_level, Confidence: $confidence%)"
                fi
            fi
        done
    else
        # Fallback: Use python for parsing
        python3 << PYEOF
import json
import sys
from datetime import datetime

jobs_file = "$JOBS_FILE"
predictions_file = "$PREDICTIONS_FILE"

with open(jobs_file, 'r') as f:
    data = json.load(f)

jobs = data.get('jobs', [])
at_risk = 0
high_conf = 0
preventive = 0

for job in jobs:
    name = job.get('name', 'unknown')
    job_id = job.get('id', 'unknown')
    state = job.get('state', {})
    consecutive_errors = state.get('consecutiveErrors', 0)
    last_error = state.get('lastError', 'none')
    last_status = state.get('lastStatus', 'unknown')
    enabled = job.get('enabled', False)

    if not enabled:
        continue

    risk_level = "LOW"
    confidence = 0
    window = 0
    factors = ""
    action = ""

    if consecutive_errors >= 3:
        risk_level = "CRITICAL"
        confidence = 95
        window = 1
        factors = f"consecutiveErrors={consecutive_errors}, lastError='{last_error}'"
        action = "Immediate retry required"
        preventive += 1
    elif consecutive_errors >= 2:
        risk_level = "HIGH"
        confidence = 80
        window = 2
        factors = f"consecutiveErrors={consecutive_errors} trending up"
        action = "Schedule preventive retry"
    elif consecutive_errors >= 1:
        risk_level = "MEDIUM"
        confidence = 60
        window = 3
        factors = f"consecutiveErrors={consecutive_errors}, lastStatus='{last_status}'"
        action = "Monitor closely"

    if risk_level != "LOW":
        at_risk += 1
        if confidence >= 80:
            high_conf += 1

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        pred_id = f"pred-{job_id[:8]}-{int(datetime.now().timestamp())}"

        with open(predictions_file, 'a') as pf:
            pf.write(f"## Prediction: {pred_id}\n")
            pf.write(f"- **Job**: {name} ({job_id})\n")
            pf.write(f"- **Risk Level**: {risk_level}\n")
            pf.write(f"- **Confidence**: {confidence}%\n")
            pf.write(f"- **Prediction Window**: Next {window} cycle(s)\n")
            pf.write(f"- **Triggering Factors**: {factors}\n")
            pf.write(f"- **Recommended Action**: {action}\n")
            pf.write(f"- **Status**: PENDING\n")
            pf.write(f"- **Created**: {timestamp}\n\n")

        print(f"[RSI-JOB-MGR] Prediction: {name} (Risk: {risk_level}, Confidence: {confidence}%)")

print(f"[RSI-JOB-MGR] Analysis complete: {at_risk} at-risk, {high_conf} high-confidence, {preventive} preventive actions")
PYEOF
    fi

    log_info "Analysis complete: $at_risk_count at-risk jobs, $high_confidence_count high-confidence predictions, $preventive_actions preventive actions"
}

# Function: Update prediction status
update_prediction() {
    local pred_id="$1"
    local new_status="$2"

    if [ -f "$PREDICTIONS_FILE" ]; then
        sed -i "s/- \*\*Status\*\*: PENDING/- **Status**: $new_status/g" "$PREDICTIONS_FILE"
        log_info "Updated prediction $pred_id to $new_status"
    fi
}

# Function: Show status
show_status() {
    echo "=== RSI Job Manager Status ==="
    echo "Jobs file: $JOBS_FILE"
    echo "Predictions file: $PREDICTIONS_FILE"
    echo "=============================="

    if [ -f "$PREDICTIONS_FILE" ]; then
        local pred_count=$(grep -c "^## Prediction:" "$PREDICTIONS_FILE" 2>/dev/null || echo "0")
        echo "Total predictions: $pred_count"
    fi
}

# Main command handler
case "${1:-status}" in
    analyze)
        analyze_and_predict
        ;;
    status)
        show_status
        ;;
    update)
        update_prediction "$2" "$3"
        ;;
    *)
        echo "Usage: $0 {analyze|status|update <pred_id> <status>}"
        exit 1
        ;;
esac
