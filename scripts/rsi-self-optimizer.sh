#!/bin/bash
# RSI Self-Optimizer - Dynamic threshold tuning based on prediction accuracy
# Level 7: Self-Optimizing RSI with Strategy Selection
# Runs every 20 minutes (every 2nd prediction cycle)

set -e

PREDICTIONS_LOG="/home/amir/Documents/fatedfortress/memory/rsi-predictions.md"
ACCURACY_LOG="/home/amir/Documents/fatedfortress/memory/rsi-accuracy.log"
THRESHOLD_CONFIG="/home/amir/Documents/fatedfortress/.rsi-threshold.conf"
STRATEGY_LOG="/home/amir/Documents/fatedfortress/memory/rsi-strategy.log"
SCORECARD="/home/amir/Documents/fatedfortress/self-modify-scorecard.md"

echo "=== RSI Self-Optimizer - Cycle $(date +%Y-%m-%d-%H%M) ==="

# Initialize threshold config if missing
if [ ! -f "$THRESHOLD_CONFIG" ]; then
    echo "THRESHOLD=80" > "$THRESHOLD_CONFIG"
    echo "PREDICTIONS_TOTAL=0" >> "$THRESHOLD_CONFIG"
    echo "PREDICTIONS_CORRECT=0" >> "$THRESHOLD_CONFIG"
    echo "AUTO_ACTION_TRIGGERED=0" >> "$THRESHOLD_CONFIG"
    echo "AUTO_ACTION_SUCCESS=0" >> "$THRESHOLD_CONFIG"
    echo "THRESHOLD_ADAPTIVE=false" >> "$THRESHOLD_CONFIG"
    echo "ACTIVE_STRATEGY=auto" >> "$THRESHOLD_CONFIG"
    echo "API_SUCCESS_RATE=0" >> "$THRESHOLD_CONFIG"
    echo "FILE_SUCCESS_RATE=0" >> "$THRESHOLD_CONFIG"
fi

# Initialize strategy log if missing
if [ ! -f "$STRATEGY_LOG" ]; then
    echo "# RSI Strategy Performance Log" > "$STRATEGY_LOG"
    echo "Created: $(date -Iseconds)" >> "$STRATEGY_LOG"
    echo "" >> "$STRATEGY_LOG"
fi

# Source current thresholds
source "$THRESHOLD_CONFIG"

# Count this cycle
PREDICTIONS_TOTAL=$((PREDICTIONS_TOTAL + 1))

# Analyze prediction accuracy from predictions log
# Look for predictions made ~20 min ago and check if they materialized

RECENT_PREDICTIONS=$(grep -A5 "⭐ HIGH CONFIDENCE PREDICTION\|⭐ PREDICTION" "$PREDICTIONS_LOG" 2>/dev/null | head -20 || echo "")

if [ -n "$RECENT_PREDICTIONS" ]; then
    echo "Analyzing recent predictions..."
    
    # Extract job predictions and check their status
    for job_id in $(grep -oP 'Job ID: \K[a-f0-9-]+' "$PREDICTIONS_LOG" 2>/dev/null | head -5); do
        # Check if job has since failed or recovered
        JOB_STATE=$(grep -A2 "\"$job_id\"" ~/.config/openclaw/jobs.json 2>/dev/null | grep consecutiveErrors | grep -oP '\d+' || echo "0")
        
        # Compare prediction vs actual
        PREDICTED_FAIL=$(grep -B3 "$job_id" "$PREDICTIONS_LOG" | grep -c "HIGH\|CRITICAL" || echo "0")
        
        if [ "$JOB_STATE" -gt "0" ] && [ "$PREDICTED_FAIL" -gt "0" ]; then
            # Correct prediction - job failed as predicted
            PREDICTIONS_CORRECT=$((PREDICTIONS_CORRECT + 1))
            echo "  ✓ Correct: Job $job_id failed as predicted"
        elif [ "$JOB_STATE" -eq "0" ] && [ "$PREDICTED_FAIL" -gt "0" ]; then
            # False positive - predicted failure but job healthy
            echo "  ⚠ False Positive: Job $job_id predicted to fail but healthy"
        fi
    done
fi

# ========== STRATEGY SELECTION ==========
echo ""
echo "=== Strategy Selection Analysis ==="

# Initialize strategy log if missing
if [ ! -f "$STRATEGY_LOG" ]; then
    echo "# RSI Strategy Performance Log" > "$STRATEGY_LOG"
    echo "Created: $(date -Iseconds)" >> "$STRATEGY_LOG"
    echo "" >> "$STRATEGY_LOG"
fi

# Analyze success rates by approach
API_ATTEMPTS=$(grep -c '"lastStatus":"ok"' ~/.config/openclaw/jobs.json 2>/dev/null || echo "0")
API_FAILURES=$(grep -c '"lastStatus":"error"' ~/.config/openclaw/jobs.json 2>/dev/null || echo "0")

if [ "$API_ATTEMPTS" -gt "0" ]; then
    TOTAL_API=$((API_ATTEMPTS + API_FAILURES))
    API_SUCCESS_RATE=$((API_ATTEMPTS * 100 / TOTAL_API))
else
    API_SUCCESS_RATE=50
fi

# Get direct file operation success rate
FILE_ATTEMPTS=$(grep -c "SUCCESS\|COMPLETE" /home/amir/Documents/fatedfortress/memory/rsi-self-heal.log 2>/dev/null || echo "0")
FILE_FAILURES=$(grep -c "FAILED\|ERROR" /home/amir/Documents/fatedfortress/memory/rsi-self-heal.log 2>/dev/null || echo "0")

if [ "$FILE_ATTEMPTS" -gt "0" ]; then
    TOTAL_FILE=$((FILE_ATTEMPTS + FILE_FAILURES))
    FILE_SUCCESS_RATE=$((FILE_ATTEMPTS * 100 / TOTAL_FILE))
else
    FILE_SUCCESS_RATE=50
fi

echo "API Success Rate: ${API_SUCCESS_RATE}%"
echo "File Operation Success Rate: ${FILE_SUCCESS_RATE}%"

# Auto-select best strategy
STRATEGY_DECISION=""
if [ "$API_SUCCESS_RATE" -gt "$FILE_SUCCESS_RATE" ]; then
    BEST_STRATEGY="api"
    STRATEGY_DECISION="API performing better - maintaining API-first approach"
elif [ "$FILE_SUCCESS_RATE" -gt "$API_SUCCESS_RATE" ]; then
    BEST_STRATEGY="file"
    STRATEGY_DECISION="File operations more reliable - switching to file-first"
else
    BEST_STRATEGY="api"
    STRATEGY_DECISION="Equal performance - maintaining default API approach"
fi

# A/B Testing: Occasionally try the other approach (10% chance)
if [ $((RANDOM % 10)) -eq 0 ]; then
    if [ "$BEST_STRATEGY" = "api" ]; then
        BEST_STRATEGY="file"
        STRATEGY_DECISION="A/B Test: Trying file approach despite API success"
    else
        BEST_STRATEGY="api"
        STRATEGY_DECISION="A/B Test: Trying API approach despite file success"
    fi
fi

echo "Selected Strategy: $BEST_STRATEGY"
echo "Rationale: $STRATEGY_DECISION"

# Log strategy decision
echo "[$(date -Iseconds)] Strategy: $BEST_STRATEGY | API: ${API_SUCCESS_RATE}% | File: ${FILE_SUCCESS_RATE}% | Decision: $STRATEGY_DECISION" >> "$STRATEGY_LOG"

# Update active strategy in config
sed -i "s/ACTIVE_STRATEGY=.*/ACTIVE_STRATEGY=$BEST_STRATEGY/" "$THRESHOLD_CONFIG" 2>/dev/null || echo "ACTIVE_STRATEGY=$BEST_STRATEGY" >> "$THRESHOLD_CONFIG"
sed -i "s/API_SUCCESS_RATE=.*/API_SUCCESS_RATE=$API_SUCCESS_RATE/" "$THRESHOLD_CONFIG" 2>/dev/null || echo "API_SUCCESS_RATE=$API_SUCCESS_RATE" >> "$THRESHOLD_CONFIG"
sed -i "s/FILE_SUCCESS_RATE=.*/FILE_SUCCESS_RATE=$FILE_SUCCESS_RATE/" "$THRESHOLD_CONFIG" 2>/dev/null || echo "FILE_SUCCESS_RATE=$FILE_SUCCESS_RATE" >> "$THRESHOLD_CONFIG"

# Update scorecard with strategy info
sed -i "s|Active Strategy:.*|Active Strategy: $BEST_STRATEGY (API: ${API_SUCCESS_RATE}% | File: ${FILE_SUCCESS_RATE}%)|" "$SCORECARD" 2>/dev/null || true
sed -i "s|Strategy Selection:.*|Strategy Selection: ✅ Active - $STRATEGY_DECISION|" "$SCORECARD" 2>/dev/null || true

# ========== ADAPTIVE THRESHOLD ==========
echo ""
echo "=== Adaptive Threshold Tuning ==="

# Calculate accuracy if we have data
if [ "$PREDICTIONS_TOTAL" -gt "5" ]; then
    ACCURACY=$((PREDICTIONS_CORRECT * 100 / PREDICTIONS_TOTAL))
    echo "Current Prediction Accuracy: ${ACCURACY}%"
    
    # Adaptive threshold tuning
    # If accuracy > 90% and auto-action success > 80%, lower threshold slightly
    # If accuracy < 70% or auto-action success < 60%, raise threshold
    
    # Enable adaptive mode if predictions accumulated
    if [ "$PREDICTIONS_TOTAL" -gt "10" ]; then
        sed -i 's/THRESHOLD_ADAPTIVE=.*/THRESHOLD_ADAPTIVE=true/' "$THRESHOLD_CONFIG"
        THRESHOLD_ADAPTIVE="true"
        echo "Adaptive mode: ENABLED (data threshold met)"
    fi
    
    if [ "$THRESHOLD_ADAPTIVE" = "true" ]; then
        if [ "$ACCURACY" -gt "90" ]; then
            NEW_THRESHOLD=$((THRESHOLD - 5))
            if [ "$NEW_THRESHOLD" -lt "70" ]; then
                NEW_THRESHOLD=70
            fi
            echo "High accuracy (${ACCURACY}%) - Lowering threshold to ${NEW_THRESHOLD}%"
        elif [ "$ACCURACY" -lt "70" ]; then
            NEW_THRESHOLD=$((THRESHOLD + 5))
            if [ "$NEW_THRESHOLD" -gt "90" ]; then
                NEW_THRESHOLD=90
            fi
            echo "Low accuracy (${ACCURACY}%) - Raising threshold to ${NEW_THRESHOLD}%"
        else
            NEW_THRESHOLD=$THRESHOLD
            echo "Accuracy stable - maintaining threshold at ${THRESHOLD}%"
        fi
        
        if [ "$NEW_THRESHOLD" != "$THRESHOLD" ]; then
            echo "Updating threshold config..."
            sed -i "s|THRESHOLD=.*|THRESHOLD=$NEW_THRESHOLD|" "$THRESHOLD_CONFIG"
            THRESHOLD=$NEW_THRESHOLD
        fi
    fi
else
    echo "Collecting more predictions... ($PREDICTIONS_TOTAL/6 needed)"
fi

# Log auto-actions taken by predictive analyzer
AUTO_ACTIONS=$(grep -c "TRIGGERED\|Status: TRIGGERED" "$PREDICTIONS_LOG" 2>/dev/null | tail -1 || echo "0")
AUTO_ACTIONS=$(echo "$AUTO_ACTIONS" | tr -d '\n')
sed -i "s/AUTO_ACTION_TRIGGERED=.*/AUTO_ACTION_TRIGGERED=$AUTO_ACTIONS/" "$THRESHOLD_CONFIG"

# Write updated config
cat > "$THRESHOLD_CONFIG" << EOF
THRESHOLD=$THRESHOLD
PREDICTIONS_TOTAL=$PREDICTIONS_TOTAL
PREDICTIONS_CORRECT=$PREDICTIONS_CORRECT
AUTO_ACTION_TRIGGERED=$AUTO_ACTIONS
AUTO_ACTION_SUCCESS=$AUTO_ACTION_SUCCESS
THRESHOLD_ADAPTIVE=${THRESHOLD_ADAPTIVE:-false}
ACTIVE_STRATEGY=${BEST_STRATEGY:-auto}
API_SUCCESS_RATE=${API_SUCCESS_RATE:-0}
FILE_SUCCESS_RATE=${FILE_SUCCESS_RATE:-0}
EOF

# Update scorecard
sed -i "s|THRESHOLD=.*|THRESHOLD=$THRESHOLD|" "$SCORECARD" 2>/dev/null || true
sed -i "s|Prediction Accuracy:.*|Prediction Accuracy: ${ACCURACY}% (${PREDICTIONS_CORRECT}\/$PREDICTIONS_TOTAL)|" "$SCORECARD" 2>/dev/null || true
sed -i "s|Active Strategy:.*|Active Strategy: ${BEST_STRATEGY:-auto} (API: ${API_SUCCESS_RATE}% | File: ${FILE_SUCCESS_RATE}%)|" "$SCORECARD" 2>/dev/null || true

echo "=== Self-Optimization Complete ==="
echo "Current Threshold: ${THRESHOLD}%"
echo "Prediction Accuracy: ${ACCURACY}%"
echo "Adaptive Mode: ${THRESHOLD_ADAPTIVE:-false}"
echo "Active Strategy: ${BEST_STRATEGY:-auto} (API: ${API_SUCCESS_RATE}% | File: ${FILE_SUCCESS_RATE}%)"
