#!/bin/bash
# Runs on Stop for brainstorming skill
# Reminds to save design decisions to context

echo "::group::Brainstorming Complete"
echo ""
echo "Design session complete!"
echo ""
echo "Recommended next steps:"
echo "  1. Save key decisions to shared-context.json"
echo "  2. Create ADR if architectural decision was made"
echo "  3. Break down into implementation tasks"
echo ""
echo "Consider using these skills next:"
echo "  - /architecture-decision-record (document decisions)"
echo "  - /api-design-framework (if API was designed)"
echo "  - /database-schema-designer (if schema was designed)"
echo ""
echo "::endgroup::"

exit 0
