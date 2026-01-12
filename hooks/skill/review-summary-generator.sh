#!/bin/bash
# Runs on Stop for code-review-playbook skill
# Generates review summary

echo "::group::Code Review Summary"
echo ""
echo "========================================"
echo "  CODE REVIEW COMPLETE"
echo "========================================"
echo ""
echo "Review checklist:"
echo "  [ ] All blocking issues addressed"
echo "  [ ] Non-blocking suggestions noted"
echo "  [ ] Tests pass"
echo "  [ ] No security concerns"
echo "  [ ] Documentation updated if needed"
echo ""
echo "Conventional comment prefixes used:"
echo "  - blocking: Must fix before merge"
echo "  - suggestion: Consider this improvement"
echo "  - nitpick: Minor style issue"
echo "  - question: Needs clarification"
echo "  - praise: Good work!"
echo ""
echo "========================================"
echo "::endgroup::"

# Output systemMessage for user visibility
echo '{"continue":true,"suppressOutput":true}'
exit 0
