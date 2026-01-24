#!/bin/bash
# 30-second OrchestKit showcase - rapid command demo
# Timing: matches ShowcaseDemo.tsx segments

# Colors
PURPLE='\033[0;35m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
DIM='\033[2m'
NC='\033[0m'

clear

# 0-3s: Hook overlay shows (terminal waits)
sleep 3

# Scene 1: /explore (3-7s)
echo -e "${WHITE}$ ${CYAN}claude ${PURPLE}\"/explore how does auth work?\"${NC}"
sleep 0.5
echo -e "${DIM}Spawning explore agent...${NC}"
sleep 0.3
echo -e "${GREEN}✓${NC} Found 12 auth-related files"
echo -e "${GREEN}✓${NC} Identified JWT middleware at ${BLUE}src/auth/jwt.ts${NC}"
echo -e "${GREEN}✓${NC} OAuth flow in ${BLUE}src/auth/providers/${NC}"
sleep 2.2

# Scene 2: /implement (7-11s)
echo ""
echo -e "${WHITE}$ ${CYAN}claude ${PURPLE}\"/implement add user dashboard\"${NC}"
sleep 0.5
echo -e "${DIM}Launching parallel agents...${NC}"
sleep 0.2
echo -e "  ${YELLOW}◐${NC} backend-system-architect analyzing..."
echo -e "  ${YELLOW}◐${NC} frontend-ui-developer designing..."
echo -e "  ${YELLOW}◐${NC} test-generator planning..."
sleep 0.4
echo -e "${GREEN}✓${NC} Created ${BLUE}src/pages/Dashboard.tsx${NC}"
echo -e "${GREEN}✓${NC} Created ${BLUE}src/api/dashboard.ts${NC}"
echo -e "${GREEN}✓${NC} Added 8 test cases"
sleep 1.9

# Scene 3: /commit + /create-pr (11-15s)
echo ""
echo -e "${WHITE}$ ${CYAN}claude ${PURPLE}\"/commit\"${NC}"
sleep 0.4
echo -e "${GREEN}✓${NC} feat(dashboard): Add user dashboard with analytics"
echo -e "${DIM}   3 files changed, 247 insertions(+)${NC}"
sleep 0.5
echo -e "${WHITE}$ ${CYAN}claude ${PURPLE}\"/create-pr\"${NC}"
sleep 0.4
echo -e "${GREEN}✓${NC} PR #142 created: ${BLUE}https://github.com/you/repo/pull/142${NC}"
sleep 2.2

# Scene 4: /review-pr (15-19s)
echo ""
echo -e "${WHITE}$ ${CYAN}claude ${PURPLE}\"/review-pr 142\"${NC}"
sleep 0.4
echo -e "${DIM}6 agents reviewing in parallel...${NC}"
sleep 0.3
echo -e "  ${GREEN}✓${NC} security-auditor: No vulnerabilities"
echo -e "  ${GREEN}✓${NC} performance-engineer: Bundle +2.1KB (OK)"
echo -e "  ${GREEN}✓${NC} accessibility-specialist: WCAG 2.2 compliant"
echo -e "  ${GREEN}✓${NC} test-generator: Coverage 87%"
echo -e "  ${YELLOW}!${NC} documentation-specialist: Add JSDoc"
sleep 2.3

# Scene 5: /fix-issue (19-23s)
echo ""
echo -e "${WHITE}$ ${CYAN}claude ${PURPLE}\"/fix-issue 138\"${NC}"
sleep 0.4
echo -e "${DIM}Analyzing issue #138: Login timeout on slow networks${NC}"
sleep 0.3
echo -e "${GREEN}✓${NC} Root cause: Missing retry logic"
echo -e "${GREEN}✓${NC} Fix applied: Added exponential backoff"
echo -e "${GREEN}✓${NC} Tests passing"
sleep 2.3

# Scene 6: Quick montage (23-27s)
echo ""
echo -e "${WHITE}$ ${CYAN}claude ${PURPLE}\"/brainstorming\"${NC} ${DIM}→ 5 approaches${NC}"
sleep 0.5
echo -e "${WHITE}$ ${CYAN}claude ${PURPLE}\"/recall patterns\"${NC} ${DIM}→ 3 decisions${NC}"
sleep 0.5
echo -e "${WHITE}$ ${CYAN}claude ${PURPLE}\"/doctor\"${NC} ${DIM}→ All healthy${NC}"
sleep 2

# 27-30s: CTA overlay shows
echo ""
sleep 3
