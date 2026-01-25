#!/usr/bin/env python3
"""
Verification script for Metadata-Filtered Single Graph architecture.
Validates that all scripts use the correct user_id and metadata structure.
"""
import sys
import re
from pathlib import Path
from typing import List, Dict, Tuple

# Add lib directory to path
_SCRIPT_DIR = Path(__file__).parent
_LIB_DIR = _SCRIPT_DIR.parent / "lib"
if str(_LIB_DIR) not in sys.path:
    sys.path.insert(0, str(_LIB_DIR))

PROJECT_ROOT = _SCRIPT_DIR.parent.parent.parent.parent
SCRIPTS_DIR = _SCRIPT_DIR.parent


def check_user_id_in_file(file_path: Path) -> Tuple[bool, List[str]]:
    """Check if file uses correct user_id."""
    issues = []
    try:
        content = file_path.read_text()
        
        # Check for old user_id
        if 'orchestkit-plugin-structure' in content:
            issues.append(f"Found old user_id 'orchestkit-plugin-structure'")
        
        # Check for new user_id
        if 'orchestkit:all-agents' in content:
            return (True, issues)
        else:
            # Some files might not have user_id (like utilities)
            if 'USER_ID' in content or 'user_id' in content:
                issues.append("No 'orchestkit:all-agents' user_id found")
                return (False, issues)
    except Exception as e:
        issues.append(f"Error reading file: {e}")
        return (False, issues)
    
    return (True, issues)


def check_metadata_fields(file_path: Path) -> Tuple[bool, List[str]]:
    """Check if file includes required metadata fields."""
    issues = []
    try:
        content = file_path.read_text()
        
        # Check for agent_name in agent creation scripts
        if 'create-all-agent-memories.py' in str(file_path):
            if '"agent_name"' not in content and "'agent_name'" not in content:
                issues.append("Missing 'agent_name' in metadata")
            if '"agent_type"' not in content and "'agent_type'" not in content:
                issues.append("Missing 'agent_type' in metadata")
            if '"shared"' not in content and "'shared'" not in content:
                issues.append("Missing 'shared' in metadata")
        
        # Check for shared=True in skill/tech/category scripts
        if any(x in str(file_path) for x in ['create-all-skill-memories.py', 'create-technology-memories.py', 'create-category-memories.py']):
            if '"shared": True' not in content and "'shared': True" not in content:
                issues.append("Missing 'shared: True' in metadata")
    except Exception as e:
        issues.append(f"Error reading file: {e}")
    
    return (len(issues) == 0, issues)


def check_hook_agent_detection() -> Tuple[bool, List[str]]:
    """Check if hook detects agent context."""
    issues = []
    hook_path = PROJECT_ROOT / "hooks" / "skill" / "decision-processor.ts"
    
    if not hook_path.exists():
        issues.append("Hook file not found")
        return (False, issues)
    
    try:
        content = hook_path.read_text()
        
        if 'CLAUDE_AGENT_ID' not in content:
            issues.append("Hook doesn't check CLAUDE_AGENT_ID")
        if 'agent_name' not in content:
            issues.append("Hook doesn't add agent_name to metadata")
        if 'orchestkit:all-agents' not in content:
            issues.append("Hook doesn't use 'orchestkit:all-agents' user_id")
    except Exception as e:
        issues.append(f"Error reading hook: {e}")
        return (False, issues)
    
    return (len(issues) == 0, issues)


def check_query_helpers() -> Tuple[bool, List[str]]:
    """Check if query helpers exist and have correct functions."""
    issues = []
    helper_path = _SCRIPT_DIR / "agent-queries.py"
    
    if not helper_path.exists():
        issues.append("agent-queries.py not found")
        return (False, issues)
    
    try:
        content = helper_path.read_text()
        
        required_functions = [
            'search_agent_specific',
            'search_cross_agent',
            'search_shared_knowledge',
            'search_by_category',
            'search_agent_and_shared'
        ]
        
        for func in required_functions:
            if f'def {func}' not in content:
                issues.append(f"Missing function: {func}")
    except Exception as e:
        issues.append(f"Error reading helper: {e}")
        return (False, issues)
    
    return (len(issues) == 0, issues)


def check_search_flags() -> Tuple[bool, List[str]]:
    """Check if search script has new flags."""
    issues = []
    search_path = SCRIPTS_DIR / "crud" / "search-memories.py"
    
    if not search_path.exists():
        issues.append("search-memories.py not found")
        return (False, issues)
    
    try:
        content = search_path.read_text()
        
        if '--agent-filter' not in content:
            issues.append("Missing --agent-filter flag")
        if '--shared-only' not in content:
            issues.append("Missing --shared-only flag")
    except Exception as e:
        issues.append(f"Error reading search script: {e}")
        return (False, issues)
    
    return (len(issues) == 0, issues)


def check_visualization_flags() -> Tuple[bool, List[str]]:
    """Check if visualization script has new flags."""
    issues = []
    viz_path = SCRIPTS_DIR / "visualization" / "visualize-mem0-graph.py"
    
    if not viz_path.exists():
        issues.append("visualize-mem0-graph.py not found")
        return (False, issues)
    
    try:
        content = viz_path.read_text()
        
        if '--agent-filter' not in content:
            issues.append("Missing --agent-filter flag")
        if '--show-shared' not in content and '--no-shared' not in content:
            issues.append("Missing --show-shared/--no-shared flags")
    except Exception as e:
        issues.append(f"Error reading visualization script: {e}")
        return (False, issues)
    
    return (len(issues) == 0, issues)


def main():
    """Run all verification checks."""
    print("=" * 60)
    print("Metadata-Filtered Single Graph Architecture Verification")
    print("=" * 60)
    print()
    
    all_passed = True
    results = []
    
    # Check creation scripts
    print("Checking creation scripts...")
    creation_scripts = [
        SCRIPTS_DIR / "create" / "create-all-agent-memories.py",
        SCRIPTS_DIR / "create" / "create-all-skill-memories.py",
        SCRIPTS_DIR / "create" / "create-technology-memories.py",
        SCRIPTS_DIR / "create" / "create-category-memories.py",
        SCRIPTS_DIR / "create" / "create-deep-relationships.py",
    ]
    
    for script in creation_scripts:
        if script.exists():
            user_id_ok, user_id_issues = check_user_id_in_file(script)
            metadata_ok, metadata_issues = check_metadata_fields(script)
            
            passed = user_id_ok and metadata_ok
            all_passed = all_passed and passed
            
            status = "✓" if passed else "✗"
            print(f"  {status} {script.name}")
            
            if user_id_issues:
                for issue in user_id_issues:
                    print(f"    - {issue}")
            if metadata_issues:
                for issue in metadata_issues:
                    print(f"    - {issue}")
            
            results.append((script.name, passed, user_id_issues + metadata_issues))
        else:
            print(f"  ⚠ {script.name} not found")
    
    print()
    
    # Check validation scripts
    print("Checking validation scripts...")
    validation_scripts = [
        SCRIPTS_DIR / "validation" / "validate-data.py",
        SCRIPTS_DIR / "validation" / "update-memories-metadata.py",
    ]
    
    for script in validation_scripts:
        if script.exists():
            user_id_ok, user_id_issues = check_user_id_in_file(script)
            status = "✓" if user_id_ok else "✗"
            print(f"  {status} {script.name}")
            
            if user_id_issues:
                for issue in user_id_issues:
                    print(f"    - {issue}")
            
            all_passed = all_passed and user_id_ok
            results.append((script.name, user_id_ok, user_id_issues))
        else:
            print(f"  ⚠ {script.name} not found")
    
    print()
    
    # Check hook
    print("Checking hook...")
    hook_ok, hook_issues = check_hook_agent_detection()
    status = "✓" if hook_ok else "✗"
    print(f"  {status} decision-processor.ts")
    if hook_issues:
        for issue in hook_issues:
            print(f"    - {issue}")
    all_passed = all_passed and hook_ok
    results.append(("decision-processor.ts", hook_ok, hook_issues))
    
    print()
    
    # Check query helpers
    print("Checking query helpers...")
    helpers_ok, helpers_issues = check_query_helpers()
    status = "✓" if helpers_ok else "✗"
    print(f"  {status} agent-queries.py")
    if helpers_issues:
        for issue in helpers_issues:
            print(f"    - {issue}")
    all_passed = all_passed and helpers_ok
    results.append(("agent-queries.py", helpers_ok, helpers_issues))
    
    print()
    
    # Check search flags
    print("Checking search script...")
    search_ok, search_issues = check_search_flags()
    status = "✓" if search_ok else "✗"
    print(f"  {status} search-memories.py")
    if search_issues:
        for issue in search_issues:
            print(f"    - {issue}")
    all_passed = all_passed and search_ok
    results.append(("search-memories.py", search_ok, search_issues))
    
    print()
    
    # Check visualization flags
    print("Checking visualization script...")
    viz_ok, viz_issues = check_visualization_flags()
    status = "✓" if viz_ok else "✗"
    print(f"  {status} visualize-mem0-graph.py")
    if viz_issues:
        for issue in viz_issues:
            print(f"    - {issue}")
    all_passed = all_passed and viz_ok
    results.append(("visualize-mem0-graph.py", viz_ok, viz_issues))
    
    print()
    print("=" * 60)
    
    if all_passed:
        print("✓ All checks passed! Architecture implementation is correct.")
        return 0
    else:
        print("✗ Some checks failed. Please review the issues above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
