#!/bin/bash
# Runs on Stop for llm-evaluation skill
# Collects and summarizes evaluation metrics

echo "::group::LLM Evaluation Summary"

# Check for evaluation results
if [ -f "eval_results.json" ]; then
  echo "Evaluation results found:"
  cat eval_results.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
if isinstance(data, dict):
    for key, value in data.items():
        if isinstance(value, (int, float)):
            print(f'  {key}: {value:.2f}' if isinstance(value, float) else f'  {key}: {value}')
" 2>/dev/null || cat eval_results.json | head -20
fi

# Check for deepeval results
if [ -d ".deepeval" ]; then
  echo ""
  echo "DeepEval results directory found"
  ls -la .deepeval/ 2>/dev/null | tail -5
fi

# Check for ragas results
if [ -f "ragas_results.json" ]; then
  echo ""
  echo "RAGAS evaluation results found"
fi

echo ""
echo "Evaluation complete - review metrics above"
echo "::endgroup::"

# Output systemMessage for user visibility
echo '{"continue":true,"suppressOutput":true}'
exit 0
