#!/usr/bin/env python3
"""
Generate all graph visualizations: full graph, agent-specific, shared knowledge, and category views.
Creates a comprehensive dashboard showing all perspectives of the memory graph.
"""
import sys
import json
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

# Add lib directory to path
_SCRIPT_DIR = Path(__file__).parent
_LIB_DIR = _SCRIPT_DIR.parent / "lib"
PROJECT_ROOT = _SCRIPT_DIR.parent.parent.parent.parent
OUTPUTS_DIR = PROJECT_ROOT / "outputs"

if str(_LIB_DIR) not in sys.path:
    sys.path.insert(0, str(_LIB_DIR))

from mem0_client import get_mem0_client  # type: ignore  # noqa: E402


def get_all_agents() -> List[str]:
    """Get list of all agent names from mem0."""
    try:
        client = get_mem0_client()
        result = client.search(
            query="agent specialized AI persona",
            filters={"user_id": "orchestkit:all-agents", "metadata": {"entity_type": "Agent"}},
            limit=100
        )
        agents = []
        for memory in result.get("results", []):
            metadata = memory.get("metadata", {})
            if "agent_name" in metadata:
                agents.append(metadata["agent_name"])
            elif "name" in metadata:
                agents.append(metadata["name"])
        return sorted(set(agents))
    except Exception as e:
        print(f"Warning: Could not fetch agents: {e}")
        return []


def get_all_categories() -> List[str]:
    """Get list of all categories from mem0."""
    try:
        client = get_mem0_client()
        result = client.search(
            query="category groups related",
            filters={"user_id": "orchestkit:all-agents", "metadata": {"entity_type": "Category"}},
            limit=50
        )
        categories = []
        for memory in result.get("results", []):
            metadata = memory.get("metadata", {})
            if "category_slug" in metadata:
                categories.append(metadata["category_slug"])
            elif "category" in metadata:
                categories.append(metadata["category"])
        return sorted(set(categories))
    except Exception as e:
        print(f"Warning: Could not fetch categories: {e}")
        return []


def generate_graph(
    output_name: str,
    user_id: str = "orchestkit:all-agents",
    agent_filter: Optional[str] = None,
    show_shared: bool = True,
    format: str = "plotly",
    limit: Optional[int] = None
) -> bool:
    """Generate a single graph visualization."""
    viz_script = _SCRIPT_DIR / "visualize-mem0-graph.py"
    
    # Ensure output goes to outputs/ directory
    if not output_name.startswith("outputs/"):
        output_name = f"outputs/{output_name}"
    
    cmd = [
        sys.executable,
        str(viz_script),
        "--user-id", user_id,
        "--output", output_name,
        "--format", format
    ]
    
    if agent_filter:
        cmd.extend(["--agent-filter", agent_filter])
    
    if not show_shared:
        cmd.append("--no-shared")
    
    if limit:
        cmd.extend(["--limit", str(limit)])
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_ROOT)
        if result.returncode == 0:
            # Check if file was actually created
            output_path = PROJECT_ROOT / output_name
            if output_path.exists():
                print(f"  ✓ Generated: {output_name}")
                return True
            else:
                # Check for JSON fallback
                json_path = output_path.with_suffix('.json')
                if json_path.exists():
                    print(f"  ⚠ Generated JSON (Plotly not available): {json_path.name}")
                    return False
                else:
                    print(f"  ✗ File not created: {output_name}")
                    return False
        else:
            print(f"  ✗ Failed: {output_name}")
            if result.stderr:
                print(f"    Error: {result.stderr[:200]}")
            return False
    except Exception as e:
        print(f"  ✗ Error generating {output_name}: {e}")
        return False


def create_dashboard_html(graphs: List[Dict[str, Any]]) -> str:
    """Create an HTML dashboard showing all graph visualizations."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mem0 Graph Dashboard - OrchestKit</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        .header {{
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }}
        .header h1 {{
            color: #333;
            font-size: 2.5em;
            margin-bottom: 10px;
        }}
        .header p {{
            color: #666;
            font-size: 1.1em;
        }}
        .stats {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }}
        .stat-card {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .stat-card h3 {{
            color: #667eea;
            font-size: 0.9em;
            text-transform: uppercase;
            margin-bottom: 10px;
        }}
        .stat-card .value {{
            font-size: 2em;
            font-weight: bold;
            color: #333;
        }}
        .graphs-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(600px, 1fr));
            gap: 30px;
            margin-bottom: 30px;
        }}
        .graph-card {{
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .graph-card-header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
        }}
        .graph-card-header h2 {{
            font-size: 1.5em;
            margin-bottom: 5px;
        }}
        .graph-card-header p {{
            opacity: 0.9;
            font-size: 0.9em;
        }}
        .graph-card-content {{
            padding: 20px;
        }}
        .graph-card-content iframe {{
            width: 100%;
            height: 600px;
            border: none;
            border-radius: 8px;
        }}
        .graph-card-content .graph-link {{
            display: inline-block;
            margin-top: 15px;
            padding: 10px 20px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            transition: background 0.3s;
        }}
        .graph-card-content .graph-link:hover {{
            background: #5568d3;
        }}
        .tabs {{
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }}
        .tab {{
            padding: 10px 20px;
            background: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1em;
            transition: all 0.3s;
        }}
        .tab:hover {{
            background: #f0f0f0;
        }}
        .tab.active {{
            background: #667eea;
            color: white;
        }}
        .tab-content {{
            display: none;
        }}
        .tab-content.active {{
            display: block;
        }}
        .footer {{
            text-align: center;
            color: white;
            padding: 20px;
            opacity: 0.8;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Mem0 Graph Dashboard</h1>
            <p>Multi-Agent Memory Architecture Visualization</p>
            <p style="margin-top: 10px; font-size: 0.9em; color: #999;">Generated: {timestamp}</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <h3>Total Graphs</h3>
                <div class="value">{len(graphs)}</div>
            </div>
            <div class="stat-card">
                <h3>Agent Views</h3>
                <div class="value">{sum(1 for g in graphs if g.get('type') == 'agent')}</div>
            </div>
            <div class="stat-card">
                <h3>Category Views</h3>
                <div class="value">{sum(1 for g in graphs if g.get('type') == 'category')}</div>
            </div>
            <div class="stat-card">
                <h3>Shared Knowledge</h3>
                <div class="value">{sum(1 for g in graphs if g.get('type') == 'shared')}</div>
            </div>
        </div>
        
        <div class="tabs">
            <button class="tab active" onclick="showTab('all')">All Graphs</button>
            <button class="tab" onclick="showTab('agents')">Agents</button>
            <button class="tab" onclick="showTab('categories')">Categories</button>
            <button class="tab" onclick="showTab('shared')">Shared Knowledge</button>
            <button class="tab" onclick="showTab('full')">Full Graph</button>
        </div>
        
        <div id="tab-all" class="tab-content active">
            <div class="graphs-grid">
"""
    
    for graph in graphs:
        graph_type = graph.get('type', 'other')
        title = graph.get('title', 'Graph')
        description = graph.get('description', '')
        filename = graph.get('filename', '')
        
        html += f"""
                <div class="graph-card" data-type="{graph_type}">
                    <div class="graph-card-header">
                        <h2>{title}</h2>
                        <p>{description}</p>
                    </div>
                    <div class="graph-card-content">
                        <iframe src="{filename}" title="{title}"></iframe>
                        <a href="{filename}" target="_blank" class="graph-link">Open Full Screen →</a>
                    </div>
                </div>
"""
    
    html += """
            </div>
        </div>
        
        <div id="tab-agents" class="tab-content">
            <div class="graphs-grid">
"""
    
    for graph in graphs:
        if graph.get('type') == 'agent':
            html += f"""
                <div class="graph-card">
                    <div class="graph-card-header">
                        <h2>{graph.get('title')}</h2>
                        <p>{graph.get('description')}</p>
                    </div>
                    <div class="graph-card-content">
                        <iframe src="{graph.get('filename')}" title="{graph.get('title')}"></iframe>
                        <a href="{graph.get('filename')}" target="_blank" class="graph-link">Open Full Screen →</a>
                    </div>
                </div>
"""
    
    html += """
            </div>
        </div>
        
        <div id="tab-categories" class="tab-content">
            <div class="graphs-grid">
"""
    
    for graph in graphs:
        if graph.get('type') == 'category':
            html += f"""
                <div class="graph-card">
                    <div class="graph-card-header">
                        <h2>{graph.get('title')}</h2>
                        <p>{graph.get('description')}</p>
                    </div>
                    <div class="graph-card-content">
                        <iframe src="{graph.get('filename')}" title="{graph.get('title')}"></iframe>
                        <a href="{graph.get('filename')}" target="_blank" class="graph-link">Open Full Screen →</a>
                    </div>
                </div>
"""
    
    html += """
            </div>
        </div>
        
        <div id="tab-shared" class="tab-content">
            <div class="graphs-grid">
"""
    
    for graph in graphs:
        if graph.get('type') == 'shared':
            html += f"""
                <div class="graph-card">
                    <div class="graph-card-header">
                        <h2>{graph.get('title')}</h2>
                        <p>{graph.get('description')}</p>
                    </div>
                    <div class="graph-card-content">
                        <iframe src="{graph.get('filename')}" title="{graph.get('title')}"></iframe>
                        <a href="{graph.get('filename')}" target="_blank" class="graph-link">Open Full Screen →</a>
                    </div>
                </div>
"""
    
    html += """
            </div>
        </div>
        
        <div id="tab-full" class="tab-content">
            <div class="graphs-grid">
"""
    
    for graph in graphs:
        if graph.get('type') == 'full':
            html += f"""
                <div class="graph-card">
                    <div class="graph-card-header">
                        <h2>{graph.get('title')}</h2>
                        <p>{graph.get('description')}</p>
                    </div>
                    <div class="graph-card-content">
                        <iframe src="{graph.get('filename')}" title="{graph.get('title')}"></iframe>
                        <a href="{graph.get('filename')}" target="_blank" class="graph-link">Open Full Screen →</a>
                    </div>
                </div>
"""
    
    html += """
            </div>
        </div>
        
        <div class="footer">
            <p>OrchestKit Plugin - Mem0 Memory Architecture Visualization</p>
            <p>Metadata-Filtered Single Graph Architecture (9.0/10 rating)</p>
        </div>
    </div>
    
    <script>
        function showTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab content
            document.getElementById('tab-' + tabName).classList.add('active');
            
            // Add active class to clicked tab
            event.target.classList.add('active');
        }
    </script>
</body>
</html>
"""
    
    return html


def main():
    """Generate all graph visualizations and create dashboard."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate all graph visualizations")
    parser.add_argument("--user-id", default="orchestkit:all-agents", help="Mem0 user ID")
    parser.add_argument("--limit", type=int, help="Limit memories per graph")
    parser.add_argument("--agents", nargs="+", help="Specific agents to visualize (default: all)")
    parser.add_argument("--categories", nargs="+", help="Specific categories to visualize (default: all)")
    parser.add_argument("--skip-shared", action="store_true", help="Skip shared knowledge graphs")
    parser.add_argument("--skip-agents", action="store_true", help="Skip agent-specific graphs")
    parser.add_argument("--format", choices=["plotly", "mermaid", "json"], default="plotly", help="Graph format")
    args = parser.parse_args()
    
    OUTPUTS_DIR.mkdir(exist_ok=True)
    
    print("=" * 60)
    print("Generating All Graph Visualizations")
    print("=" * 60)
    print()
    
    graphs = []
    generated_count = 0
    
    # 1. Full graph (all agents + shared)
    print("1. Generating full graph (all agents + shared knowledge)...")
    # Try new user_id first, fallback to old if no memories
    full_graph_generated = generate_graph(
        "mem0-full-graph.html",
        user_id=args.user_id,
        show_shared=True,
        format=args.format,
        limit=args.limit
    )
    
    # If failed, try old user_id
    if not full_graph_generated and args.user_id == "orchestkit:all-agents":
        print("   Trying legacy user_id...")
        full_graph_generated = generate_graph(
            "mem0-full-graph.html",
            user_id="orchestkit:all-agents",
            show_shared=True,
            format=args.format,
            limit=args.limit
        )
    
    # Use existing full network graph if available
    existing_full = OUTPUTS_DIR / "mem0-full-network-graph.html"
    if not full_graph_generated and existing_full.exists():
        print(f"  ✓ Using existing: {existing_full.name}")
        full_graph_generated = True
    
    if full_graph_generated or existing_full.exists():
        graphs.append({
            "type": "full",
            "title": "Full Graph - All Agents + Shared Knowledge",
            "description": "Complete memory graph showing all agents, skills, technologies, and categories",
            "filename": "mem0-full-graph.html" if full_graph_generated else "mem0-full-network-graph.html"
        })
        generated_count += 1
    
    print()
    
    # 2. Shared knowledge only
    if not args.skip_shared:
        print("2. Generating shared knowledge graph...")
        shared_generated = generate_graph(
            "mem0-shared-knowledge.html",
            user_id=args.user_id,
            show_shared=True,
            format=args.format,
            limit=args.limit
        )
        
        # If failed, try old user_id
        if not shared_generated and args.user_id == "orchestkit:all-agents":
            print("   Trying legacy user_id...")
            shared_generated = generate_graph(
                "mem0-shared-knowledge.html",
                user_id="orchestkit:all-agents",
                show_shared=True,
                format=args.format,
                limit=args.limit
            )
        
        # Use existing network graph if available
        existing_network = OUTPUTS_DIR / "mem0-network-graph.html"
        if not shared_generated and existing_network.exists():
            print(f"  ✓ Using existing: {existing_network.name}")
            shared_generated = True
        
        if shared_generated or existing_network.exists():
            graphs.append({
                "type": "shared",
                "title": "Shared Knowledge Graph",
                "description": "Skills, technologies, and categories shared across all agents",
                "filename": "mem0-shared-knowledge.html" if shared_generated else "mem0-network-graph.html"
            })
            generated_count += 1
        print()
    
    # 3. Agent-specific graphs
    if not args.skip_agents:
        agents = args.agents if args.agents else get_all_agents()
        
        if agents:
            print(f"3. Generating {len(agents)} agent-specific graphs...")
            for agent in agents:
                agent_safe = agent.replace(" ", "-").replace("/", "-")
                filename = f"mem0-agent-{agent_safe}.html"
                
                if generate_graph(
                    filename,
                    user_id=args.user_id,
                    agent_filter=agent,
                    show_shared=False,
                    format=args.format,
                    limit=args.limit
                ):
                    graphs.append({
                        "type": "agent",
                        "title": f"Agent: {agent}",
                        "description": f"Memory graph for {agent} agent",
                        "filename": f"outputs/{filename}"
                    })
                    generated_count += 1
            print()
        else:
            print("3. No agents found, skipping agent-specific graphs")
            print()
    
    # 4. Category-specific graphs
    categories = args.categories if args.categories else get_all_categories()
    
    if categories:
        print(f"4. Generating {len(categories)} category-specific graphs...")
        for category in categories[:10]:  # Limit to first 10 categories
            category_safe = category.replace(" ", "-").replace("/", "-")
            filename = f"mem0-category-{category_safe}.html"
            
            # Use search with category filter
            try:
                client = get_mem0_client()
                result = client.search(
                    query="category",
                    filters={
                        "user_id": args.user_id,
                        "metadata.category": category
                    },
                    limit=args.limit or 100
                )
                
                if result.get("results"):
                    # Generate visualization for this category
                    if generate_graph(
                        filename,
                        user_id=args.user_id,
                        show_shared=True,
                        format=args.format,
                        limit=args.limit
                    ):
                        graphs.append({
                            "type": "category",
                            "title": f"Category: {category}",
                            "description": f"Graph for {category} category",
                            "filename": f"outputs/{filename}"
                        })
                        generated_count += 1
            except Exception as e:
                print(f"  ⚠ Skipped {category}: {e}")
        print()
    else:
        print("4. No categories found, skipping category-specific graphs")
        print()
    
    # 5. Create dashboard
    print("5. Creating dashboard...")
    dashboard_html = create_dashboard_html(graphs)
    dashboard_path = OUTPUTS_DIR / "mem0-graph-dashboard.html"
    dashboard_path.write_text(dashboard_html)
    print(f"  ✓ Dashboard created: {dashboard_path}")
    print()
    
    # Summary
    print("=" * 60)
    print("Generation Complete!")
    print("=" * 60)
    print(f"Generated {generated_count} graph visualizations")
    print(f"Dashboard: {dashboard_path}")
    print()
    print("Open the dashboard in your browser:")
    print(f"  open {dashboard_path}")
    print()
    
    # Create index file
    index_path = OUTPUTS_DIR / "index.html"
    index_path.write_text(f'<meta http-equiv="refresh" content="0; url=mem0-graph-dashboard.html">')
    print(f"Index file created: {index_path}")


if __name__ == "__main__":
    main()
