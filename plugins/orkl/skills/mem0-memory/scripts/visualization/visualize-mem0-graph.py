#!/usr/bin/env python3
"""
Visualize Mem0 graph with colorized nodes by entity type.
Exports graph data from Mem0 and creates an interactive Plotly visualization.
"""
import json
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add mem0 scripts to path
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
MEM0_LIB_DIR = SCRIPT_DIR.parent / "lib"
if str(MEM0_LIB_DIR) not in sys.path:
    sys.path.insert(0, str(MEM0_LIB_DIR))

from mem0_client import get_mem0_client  # type: ignore  # noqa: E402

# Color mapping by entity type
COLOR_MAP = {
    "Agent": "#3B82F6",        # Blue
    "Skill": "#10B981",         # Green
    "Technology": "#F59E0B",    # Orange
    "Category": "#8B5CF6",      # Purple
    "Architecture": "#EF4444",  # Red
    "Unknown": "#9CA3AF"        # Gray
}

# Edge style mapping by relation type
EDGE_STYLE_MAP = {
    "uses": {"style": "solid", "width": 2, "color": "#6B7280"},
    "implements": {"style": "dash", "width": 2, "color": "#9CA3AF"},
    "extends": {"style": "dot", "width": 1.5, "color": "#D1D5DB"},
    "recommends": {"style": "solid", "width": 3, "color": "#6366F1"},
    "belongs_to": {"style": "solid", "width": 1, "color": "#A78BFA"},
    "shares_skill": {"style": "dashdot", "width": 2, "color": "#F59E0B"},
    "collaborates_with": {"style": "dash", "width": 2, "color": "#8B5CF6"},
    "default": {"style": "solid", "width": 1, "color": "#9CA3AF"}
}


def extract_entity_type(memory: Dict[str, Any]) -> str:
    """Extract entity type from memory metadata or infer from content with improved logic."""
    metadata = memory.get("metadata", {})
    
    # Check explicit entity_type (highest priority)
    if "entity_type" in metadata:
        entity_type = str(metadata["entity_type"]).strip()
        if entity_type and entity_type != "Unknown" and entity_type != "null":
            return entity_type
    
    # For relationship memories, try to infer from "from" field
    if "from" in metadata and "to" in metadata:
        from_entity = str(metadata.get("from", "")).lower()
        to_entity = str(metadata.get("to", "")).lower()
        
        # Agent patterns in "from"
        agent_keywords = ["architect", "engineer", "developer", "specialist", "auditor", "manager", "designer", "reviewer"]
        if any(keyword in from_entity for keyword in agent_keywords):
            return "Agent"
        
        # Skill patterns in "to"
        skill_indicators = ["-", "pattern", "framework", "testing", "design", "optimization"]
        if any(indicator in to_entity for indicator in skill_indicators):
            # If "from" is an agent, return Agent; otherwise it's a relationship memory
            if any(keyword in from_entity for keyword in agent_keywords):
                return "Agent"
            # Could be skill-to-skill or skill-to-technology relationship
            return "Unknown"  # Relationship memories are connections
    
    # Check type field
    if "type" in metadata:
        type_val = str(metadata["type"]).strip().lower()
        type_mapping = {
            "agent": "Agent",
            "skill": "Skill",
            "technology": "Technology",
            "category": "Category",
            "architecture": "Architecture",
            "architecture-decision": "Architecture",
            "architecturedecision": "Architecture",
            "relationship": "Unknown",
            "pattern": "Architecture",
            "multi-hop": "Unknown"
        }
        if type_val in type_mapping:
            return type_mapping[type_val]
        # Try to normalize and map
        normalized = type_val.replace("-", "").replace("_", "")
        if normalized in type_mapping:
            return type_mapping[normalized]
        # Capitalize if not in mapping
        return type_val.replace("-", " ").title().replace(" ", "")
    
    # Infer from memory content with improved patterns
    content = memory.get("memory", "").lower()
    if not content:
        return "Unknown"
    
    # Agent patterns
    agent_patterns = [
        ("agent" in content and ("uses" in content or "specialized" in content or "architect" in content)),
        ("architect" in content and ("backend" in content or "frontend" in content or "system" in content)),
        ("engineer" in content and ("database" in content or "security" in content)),
        ("developer" in content and ("frontend" in content or "ui" in content))
    ]
    if any(agent_patterns):
        return "Agent"
    
    # Skill patterns
    skill_patterns = [
        ("skill" in content and ("pattern" in content or "provides" in content or "implements" in content)),
        ("skill" in content and ("use when" in content or "covers" in content)),
        (content.count("-") >= 2 and ("pattern" in content or "framework" in content))
    ]
    if any(skill_patterns):
        return "Skill"
    
    # Technology patterns
    tech_keywords = ["technology", "framework", "library", "tool", "platform"]
    if any(keyword in content for keyword in tech_keywords):
        return "Technology"
    
    # Category patterns
    category_patterns = [
        ("category" in content and ("contains" in content or "includes" in content)),
        ("category:" in content or "category " in content)
    ]
    if any(category_patterns):
        return "Category"
    
    # Architecture patterns
    arch_patterns = [
        ("architecture" in content and ("decision" in content or "pattern" in content)),
        ("decision" in content and ("architectural" in content or "design" in content)),
        ("graph-first" in content or "progressive loading" in content or "hook-based" in content)
    ]
    if any(arch_patterns):
        return "Architecture"
    
    return "Unknown"


def extract_entity_name(memory: Dict[str, Any]) -> str:
    """Extract entity name from memory with improved parsing."""
    metadata = memory.get("metadata", {})
    
    # Try name field first (most reliable)
    if "name" in metadata and metadata["name"]:
        name = str(metadata["name"]).strip()
        if name and name != "null" and name != "None":
            return name
    
    # For relationship memories, prefer "from" field but also check "to"
    if "from" in metadata and metadata["from"]:
        from_name = str(metadata["from"]).strip()
        if from_name and from_name != "null":
            return from_name
    
    # Try to extract from memory content (first entity mentioned)
    content = memory.get("memory", "")
    if not content:
        return "Unknown"
    
    import re
    # Improved patterns for better extraction
    patterns = [
        # Pattern: "skill-name skill" or "agent-name agent"
        r'\b([a-z0-9][a-z0-9-]{2,})\s+(?:skill|agent|technology|category)\b',
        # Pattern: "agent/skill/technology skill-name"
        r'\b(?:agent|skill|technology|category)\s+([a-z0-9][a-z0-9-]{2,})\b',
        # Pattern: "OrchestKit Plugin: ..." or named entities
        r'\b([A-Z][a-zA-Z0-9\s-]{3,})\s+(?:is|provides|implements|uses|extends)',
        # Pattern: "name implements/extends/uses"
        r'\b([a-z0-9][a-z0-9-]{2,})\s+(?:implements|extends|uses|belongs_to)',
        # Pattern: Capitalized names (for architecture decisions, categories)
        r'\b([A-Z][a-zA-Z0-9\s-]{3,})\s+(?:Architecture|Category|Decision)',
        # Pattern: quoted names
        r'["\']([^"\']+)["\']',
    ]
    
    for pattern in patterns:
        matches = re.finditer(pattern, content, re.IGNORECASE)
        for match in matches:
            name = match.group(1).strip()
            # Clean up common prefixes and suffixes
            name = re.sub(r'^(the|a|an)\s+', '', name, flags=re.IGNORECASE)
            name = name.strip()
            # Validate name (not too short, not common words)
            if len(name) >= 3 and name.lower() not in ['and', 'the', 'for', 'with', 'from', 'that', 'this']:
                return name
    
    # Fallback: extract first meaningful word sequence
    words = re.findall(r'\b[a-zA-Z0-9-]{3,}\b', content)
    if words:
        # Take first 2-3 words if they form a compound name
        potential_name = '-'.join(words[:3]) if len(words) >= 2 else words[0]
        if len(potential_name) >= 3:
            return potential_name
    
    # Last resort: truncated content
    return content[:40].strip() + "..." if len(content) > 40 else content.strip()


def get_node_color(entity_type: str) -> str:
    """Get color for entity type."""
    return COLOR_MAP.get(entity_type, COLOR_MAP["Unknown"])


def get_edge_style(relation_type: str) -> Dict[str, Any]:
    """Get edge style for relation type."""
    return EDGE_STYLE_MAP.get(relation_type, EDGE_STYLE_MAP["default"])


def export_graph_data(
    user_id: str,
    limit: Optional[int] = None,
    agent_filter: Optional[str] = None,
    show_shared: bool = True
) -> Dict[str, Any]:
    """Export graph data from Mem0 with error handling to prevent hangs."""
    filter_desc = ""
    if agent_filter:
        filter_desc = f" (agent: {agent_filter})"
    elif not show_shared:
        filter_desc = " (agent-specific only)"
    print(f"Exporting graph data from Mem0 (user_id: {user_id}{filter_desc})...")
    
    client = get_mem0_client()
    
    # Build filters
    filters = {"user_id": user_id} if user_id else {}
    if agent_filter:
        # Filter by agent_name
        filters["metadata"] = {"agent_name": agent_filter}
    elif not show_shared:
        # Only show agent-specific (exclude shared)
        filters["metadata"] = {"shared": False}
    elif show_shared:
        # Include all (default behavior - no additional filter needed)
        pass
    
    # Get all memories with graph enabled
    try:
        # Use a broad query to get all memories (empty query not allowed)
        result = client.search(
            query="OrchestKit Plugin structure agent skill technology",
            filters=filters if filters else None,
            limit=limit or 1000,
            enable_graph=True
        )
        
        memories = result.get("results", [])
        relations = result.get("relations", [])
        
        print(f"Found {len(memories)} memories and {len(relations)} relationships")
        
        return {
            "memories": memories,
            "relations": relations
        }
    except Exception as e:
        error_msg = str(e)
        print(f"Error exporting graph data: {error_msg}", file=sys.stderr)
        
        # Check for timeout or connection errors - return empty instead of hanging
        if any(keyword in error_msg.lower() for keyword in ["timeout", "connection", "network", "unreachable"]):
            print("Returning empty result due to network/timeout error (prevents CI hang)", file=sys.stderr)
            return {
                "memories": [],
                "relations": []
            }
        
        # Fallback: try get_all if available
        try:
            if hasattr(client, 'get_all'):
                result = client.get_all(
                    filters={"user_id": user_id} if user_id else None,
                    limit=limit or 1000
                )
                memories = result.get("results", []) if isinstance(result, dict) else result
                return {
                    "memories": memories if isinstance(memories, list) else [],
                    "relations": []
                }
        except Exception as fallback_error:
            print(f"Fallback also failed: {fallback_error}", file=sys.stderr)
        
        # Return empty result instead of raising to prevent CI hangs
        print("Returning empty graph data to prevent workflow hang", file=sys.stderr)
        return {
            "memories": [],
            "relations": []
        }


def build_graph_structure(graph_data: Dict[str, Any]) -> Dict[str, Any]:
    """Build graph structure with nodes and edges."""
    memories = graph_data.get("memories", [])
    relations = graph_data.get("relations", [])
    
    # Build node map
    nodes = []
    node_map = {}  # memory_id -> node_index
    
    for idx, memory in enumerate(memories):
        memory_id = memory.get("id")
        if not memory_id:
            continue
        
        entity_type = extract_entity_type(memory)
        entity_name = extract_entity_name(memory)
        metadata = memory.get("metadata", {})
        
        node = {
            "id": memory_id,
            "name": entity_name,
            "entity_type": entity_type,
            "color": get_node_color(entity_type),
            "category": metadata.get("category", metadata.get("type", "unknown")),
            "memory_text": memory.get("memory", "")[:100],
            "metadata": metadata,
            "created_at": memory.get("created_at"),
            "index": idx
        }
        
        nodes.append(node)
        node_map[memory_id] = idx
    
    # Build edges from relations
    edges = []
    for relation in relations:
        source_id = relation.get("source_id") or relation.get("from_id")
        target_id = relation.get("target_id") or relation.get("to_id") or relation.get("memory_id")
        relation_type = relation.get("type") or relation.get("relation_type", "related")
        
        if source_id in node_map and target_id in node_map:
            edge_style = get_edge_style(relation_type)
            edges.append({
                "source": node_map[source_id],
                "target": node_map[target_id],
                "relation_type": relation_type,
                "style": edge_style["style"],
                "width": edge_style["width"],
                "color": edge_style["color"]
            })
    
    # Also extract relationships from memory metadata
    for memory in memories:
        memory_id = memory.get("id")
        metadata = memory.get("metadata", {})
        
        # Check for relationship metadata
        if "from" in metadata and "to" in metadata:
            from_entity = metadata["from"]
            to_entity = metadata["to"]
            relation_type = metadata.get("relation", metadata.get("relationType", "related"))
            
            # Try to find target memory by name in metadata
            for target_memory in memories:
                target_metadata = target_memory.get("metadata", {})
                if target_metadata.get("name") == to_entity or extract_entity_name(target_memory) == to_entity:
                    target_id = target_memory.get("id")
                    if memory_id in node_map and target_id in node_map:
                        edge_style = get_edge_style(relation_type)
                        edges.append({
                            "source": node_map[memory_id],
                            "target": node_map[target_id],
                            "relation_type": relation_type,
                            "style": edge_style["style"],
                            "width": edge_style["width"],
                            "color": edge_style["color"]
                        })
                    break
    
    return {
        "nodes": nodes,
        "edges": edges,
        "node_count": len(nodes),
        "edge_count": len(edges)
    }


def create_plotly_visualization(graph_structure: Dict[str, Any], output_file: str, title: str = "OrchestKit Plugin Structure - Mem0 Graph Visualization"):
    """Create interactive Plotly visualization."""
    try:
        import plotly.graph_objects as go
        import plotly.offline as pyo
        import numpy as np
    except ImportError:
        print("Error: plotly not installed. Install with: pip install plotly", file=sys.stderr)
        print("Falling back to JSON export...")
        export_json(graph_structure, output_file.replace(".html", ".json"))
        return
    
    # Try to use NetworkX for better layout
    try:
        import networkx as nx
        use_networkx = True
    except ImportError:
        use_networkx = False
        print("Note: networkx not installed. Using simple layout. Install with: pip install networkx for better layout")
    
    nodes = graph_structure["nodes"]
    edges = graph_structure["edges"]
    
    if not nodes:
        print("No nodes to visualize")
        return
    
    print(f"Creating visualization with {len(nodes)} nodes and {len(edges)} edges...")
    
    # Build graph for layout calculation with improved clustering
    if use_networkx:
        G = nx.Graph()
        node_id_to_index = {}
        for idx, node in enumerate(nodes):
            G.add_node(node["id"], entity_type=node["entity_type"], category=node["category"])
            node_id_to_index[node["id"]] = idx
        
        for edge in edges:
            source_node = nodes[edge["source"]]
            target_node = nodes[edge["target"]]
            G.add_edge(source_node["id"], target_node["id"], relation_type=edge.get("relation_type", "related"))
        
        # Calculate layout with better parameters for clustering
        try:
            # Use k parameter based on graph size for better spacing
            k_value = max(1.0, min(3.0, 50.0 / max(len(nodes), 1)))
            pos = nx.spring_layout(
                G, 
                k=k_value, 
                iterations=100,  # More iterations for better layout
                seed=42,
                weight=None  # Don't weight by relation type for initial layout
            )
            
            # Optional: Apply additional clustering by entity type
            # Group nodes by entity type for better visual clustering
            entity_groups = {}
            for node in nodes:
                et = node["entity_type"]
                if et not in entity_groups:
                    entity_groups[et] = []
                entity_groups[et].append(node["id"])
            
            # Adjust positions to cluster by entity type (subtle adjustment)
            for et, node_ids in entity_groups.items():
                if len(node_ids) > 1:
                    # Calculate centroid
                    coords = [pos[nid] for nid in node_ids]
                    centroid_x = sum(c[0] for c in coords) / len(coords)
                    centroid_y = sum(c[1] for c in coords) / len(coords)
                    
                    # Slight clustering adjustment (10% pull toward centroid)
                    for nid in node_ids:
                        x, y = pos[nid]
                        pos[nid] = (
                            x + 0.1 * (centroid_x - x),
                            y + 0.1 * (centroid_y - y)
                        )
        except Exception as e:
            print(f"Warning: Layout calculation failed: {e}, using random layout")
            pos = {node["id"]: (np.random.rand(), np.random.rand()) for node in nodes}
    else:
        # Simple random layout
        pos = {node["id"]: (np.random.rand(), np.random.rand()) for node in nodes}
    
    # Group nodes by entity type for legend
    entity_types = {}
    for node in nodes:
        entity_type = node["entity_type"]
        if entity_type not in entity_types:
            entity_types[entity_type] = {
                "x": [],
                "y": [],
                "text": [],
                "colors": [],
                "ids": [],
                "hovertext": []
            }
        
        # Use calculated position
        x, y = pos.get(node["id"], (np.random.rand(), np.random.rand()))
        entity_types[entity_type]["x"].append(x)
        entity_types[entity_type]["y"].append(y)
        
        # Truncate long names intelligently
        name = node["name"]
        if len(name) > 25:
            # Try to truncate at word boundary
            truncated = name[:22] + "..."
        else:
            truncated = name
        entity_types[entity_type]["text"].append(truncated)
        
        # Calculate node size based on degree (number of connections)
        node_degree = sum(1 for e in edges if e["source"] == idx or e["target"] == idx)
        base_size = 15
        size = base_size + min(node_degree * 3, 25)  # Scale up to 40 max
        
        entity_types[entity_type]["colors"].append(node["color"])
        entity_types[entity_type]["ids"].append(node["id"])
        entity_types[entity_type]["hovertext"].append(
            f"<b>{node['name']}</b><br>"
            f"Type: {node['entity_type']}<br>"
            f"Category: {node['category']}<br>"
            f"Connections: {node_degree}<br>"
            f"<br>{node['memory_text']}"
        )
        # Store size for later use
        if "sizes" not in entity_types[entity_type]:
            entity_types[entity_type]["sizes"] = []
        entity_types[entity_type]["sizes"].append(size)
    
    # Create figure
    fig = go.Figure()
    
    # Add edges (lines)
    if edges:
        edge_x = []
        edge_y = []
        edge_info = []
        for edge in edges:
            source_idx = edge["source"]
            target_idx = edge["target"]
            source_node = nodes[source_idx]
            target_node = nodes[target_idx]
            
            # Get coordinates from layout
            source_x, source_y = pos.get(source_node["id"], (0, 0))
            target_x, target_y = pos.get(target_node["id"], (0, 0))
            
            edge_x.extend([source_x, target_x, None])
            edge_y.extend([source_y, target_y, None])
            edge_info.append(edge)
        
        fig.add_trace(go.Scatter(
            x=edge_x, y=edge_y,
            line=dict(width=1, color='#888'),
            hoverinfo='none',
            mode='lines',
            showlegend=False
        ))
    
    # Add nodes by entity type with size variation
    for entity_type, data in entity_types.items():
        sizes = data.get("sizes", [20] * len(data["x"]))
        fig.add_trace(go.Scatter(
            x=data["x"],
            y=data["y"],
            mode='markers+text',
            name=entity_type,
            text=data["text"],
            textposition="middle center",
            textfont=dict(size=8, color='white'),
            marker=dict(
                size=sizes,
                color=data["colors"],
                line=dict(width=2, color='white'),
                opacity=0.9
            ),
            hovertext=data["hovertext"],
            hoverinfo='text',
            customdata=data["ids"],
            showlegend=True
        ))
    
    # Update layout with interactive features
    fig.update_layout(
        title={
            'text': title,
            'x': 0.5,
            'xanchor': 'center',
            'font': {'size': 18}
        },
        showlegend=True,
        hovermode='closest',
        margin=dict(b=40, l=10, r=10, t=60),
        annotations=[
            dict(
                text="Nodes colored by entity type: Agents (Blue), Skills (Green), Technologies (Orange), Categories (Purple), Architecture (Red)<br>Click legend items to filter | Hover for details | Use mouse wheel to zoom",
                showarrow=False,
                xref="paper", yref="paper",
                x=0.005, y=-0.01,
                xanchor='left', yanchor='top',
                font=dict(size=10, color='#666')
            )
        ],
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False, scaleanchor="y", scaleratio=1),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        plot_bgcolor='white',
        paper_bgcolor='white',
        # Enable zoom and pan
        dragmode='pan',
        # Legend with click-to-filter
        legend=dict(
            x=1.02,
            y=1,
            xanchor='left',
            yanchor='top',
            bgcolor='rgba(255,255,255,0.8)',
            bordercolor='#ccc',
            borderwidth=1
        ),
        # Add modebar with zoom controls
        modebar=dict(
            orientation='v',
            bgcolor='rgba(255,255,255,0.8)'
        )
    )
    
    # Add click handler via JavaScript (embedded in HTML)
    # Plotly's click events work natively, but we can enhance with custom JS
    fig.update_traces(
        selector=dict(type='scatter', mode='markers+text'),
        hovertemplate='%{hovertext}<extra></extra>'
    )
    
    # Save to HTML with interactive features
    output_path = PROJECT_ROOT / "outputs" / output_file
    output_path.parent.mkdir(exist_ok=True)
    
    # Create HTML with enhanced interactivity
    html_str = pyo.plot(fig, output_type='string', include_plotlyjs='cdn', config={
        'displayModeBar': True,
        'displaylogo': False,
        'modeBarButtonsToAdd': ['resetScale2d', 'toggleSpikelines'],
        'toImageButtonOptions': {
            'format': 'png',
            'filename': 'mem0-graph',
            'height': 800,
            'width': 1200,
            'scale': 2
        }
    })
    
    # Enhance HTML with custom JavaScript for filtering and search
    enhanced_html = html_str.replace(
        '</body>',
        '''
    <script>
    // Enhanced interactivity
    document.addEventListener('DOMContentLoaded', function() {
        // Add search functionality
        const searchDiv = document.createElement('div');
        searchDiv.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000; background: white; padding: 10px; border: 1px solid #ccc; border-radius: 4px;';
        searchDiv.innerHTML = `
            <input type="text" id="nodeSearch" placeholder="Search nodes..." style="width: 200px; padding: 5px;">
            <button onclick="filterByCategory()" style="margin-top: 5px; padding: 5px 10px;">Filter by Category</button>
        `;
        document.body.appendChild(searchDiv);
        
        // Search functionality
        const searchInput = document.getElementById('nodeSearch');
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase();
            // Highlight matching nodes (would need Plotly API for full implementation)
            console.log('Search:', query);
        });
    });
    
    // Filter by category function
    function filterByCategory() {
        // Implementation would use Plotly.restyle() to show/hide traces
        alert('Category filter - click legend items to filter by entity type');
    }
    </script>
    </body>
    '''
    )
    
    with open(output_path, 'w') as f:
        f.write(enhanced_html)
    
    print(f"✓ Visualization saved to: {output_path}")
    print(f"  Interactive features: Click legend to filter, hover for details, zoom/pan enabled")
    
    return str(output_path)


def create_networkx_visualization(graph_structure: Dict[str, Any], output_file: str):
    """Create NetworkX + Matplotlib visualization (fallback)."""
    try:
        import networkx as nx
        import matplotlib.pyplot as plt
        import matplotlib.patches as mpatches
    except ImportError:
        print("Error: networkx or matplotlib not installed", file=sys.stderr)
        export_json(graph_structure, output_file.replace(".png", ".json"))
        return
    
    nodes = graph_structure["nodes"]
    edges = graph_structure["edges"]
    
    # Create graph
    G = nx.Graph()
    
    # Add nodes
    for node in nodes:
        G.add_node(node["id"], **node)
    
    # Add edges
    for edge in edges:
        source_node = nodes[edge["source"]]
        target_node = nodes[edge["target"]]
        G.add_edge(source_node["id"], target_node["id"], **edge)
    
    # Create layout with better parameters
    pos = nx.spring_layout(G, k=2, iterations=100, seed=42)
    
    # Create figure with higher resolution
    plt.figure(figsize=(20, 16), dpi=100)
    
    # Draw edges with relation type labels
    edge_colors = []
    edge_widths = []
    for edge in edges:
        source_node = nodes[edge["source"]]
        target_node = nodes[edge["target"]]
        edge_style = get_edge_style(edge.get("relation_type", "related"))
        edge_colors.append(edge_style["color"])
        edge_widths.append(edge_style["width"])
    
    nx.draw_networkx_edges(
        G, pos, 
        alpha=0.4, 
        width=[w * 0.5 for w in edge_widths], 
        edge_color=edge_colors if edge_colors else 'gray',
        arrows=True,
        arrowsize=15,
        arrowstyle='->'
    )
    
    # Draw nodes by entity type with size based on degree
    entity_groups = {}
    node_sizes = {}
    for node in nodes:
        entity_type = node["entity_type"]
        if entity_type not in entity_groups:
            entity_groups[entity_type] = []
        entity_groups[entity_type].append(node["id"])
        # Calculate degree for size
        degree = G.degree(node["id"])
        node_sizes[node["id"]] = 300 + min(degree * 50, 500)
    
    for entity_type, node_ids in entity_groups.items():
        color = COLOR_MAP.get(entity_type, COLOR_MAP["Unknown"])
        sizes = [node_sizes.get(nid, 300) for nid in node_ids]
        nx.draw_networkx_nodes(
            G, pos,
            nodelist=node_ids,
            node_color=color,
            node_size=sizes,
            alpha=0.85,
            label=entity_type,
            edgecolors='white',
            linewidths=1.5
        )
    
    # Draw labels with smart positioning
    labels = {}
    for node in nodes:
        name = node["name"]
        # Truncate long names
        if len(name) > 25:
            name = name[:22] + "..."
        labels[node["id"]] = name
    
    # Use smart label positioning to avoid overlaps
    nx.draw_networkx_labels(
        G, pos, 
        labels, 
        font_size=7,
        font_weight='bold',
        bbox=dict(boxstyle='round,pad=0.3', facecolor='white', alpha=0.7, edgecolor='none')
    )
    
    # Add edge labels for relation types (sample)
    if len(edges) <= 50:  # Only label if not too many edges
        edge_labels = {}
        for edge in edges[:20]:  # Label first 20 edges
            source_node = nodes[edge["source"]]
            target_node = nodes[edge["target"]]
            rel_type = edge.get("relation_type", "")
            if rel_type:
                edge_labels[(source_node["id"], target_node["id"])] = rel_type[:10]
        if edge_labels:
            nx.draw_networkx_edge_labels(G, pos, edge_labels, font_size=5, alpha=0.6)
    
    # Add legend with entity types and colors
    legend_elements = [
        mpatches.Patch(color=COLOR_MAP[et], label=f"{et} ({len(node_ids)})")
        for et, node_ids in sorted(entity_groups.items())
    ]
    plt.legend(
        handles=legend_elements, 
        loc='upper left',
        fontsize=10,
        framealpha=0.9,
        title='Entity Types',
        title_fontsize=11
    )
    
    plt.title("OrchestKit Plugin Structure - Mem0 Graph Visualization", size=18, pad=20)
    plt.axis('off')
    
    # Save with high DPI
    output_path = PROJECT_ROOT / "outputs" / output_file
    output_path.parent.mkdir(exist_ok=True)
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='white')
    print(f"✓ Visualization saved to: {output_path} (300 DPI)")
    
    plt.close()
    
    return str(output_path)


def export_json(graph_structure: Dict[str, Any], output_file: str):
    """Export graph structure as JSON."""
    output_path = PROJECT_ROOT / "outputs" / output_file
    output_path.parent.mkdir(exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(graph_structure, f, indent=2, default=str)
    
    print(f"✓ Graph data exported to: {output_path}")
    return str(output_path)


def export_mermaid(graph_structure: Dict[str, Any], output_file: str):
    """Export graph as Mermaid diagram (text-based, version-controllable)."""
    nodes = graph_structure["nodes"]
    edges = graph_structure["edges"]
    
    output_path = PROJECT_ROOT / "outputs" / output_file
    output_path.parent.mkdir(exist_ok=True)
    
    lines = ["graph TD"]
    
    # Add nodes with styling
    for node in nodes:
        node_id = node["id"][:8].replace("-", "")  # Short ID for Mermaid
        name = node["name"].replace('"', "'").replace("\n", " ")  # Sanitize
        entity_type = node["entity_type"]
        color = node["color"].replace("#", "")
        
        # Mermaid node syntax: ID["Label"]:::class
        lines.append(f'    {node_id}["{name}"]')
        lines.append(f'    style {node_id} fill:#{color}')
    
    # Add edges
    for edge in edges:
        source_node = nodes[edge["source"]]
        target_node = nodes[edge["target"]]
        source_id = source_node["id"][:8].replace("-", "")
        target_id = target_node["id"][:8].replace("-", "")
        rel_type = edge.get("relation_type", "related")
        
        lines.append(f'    {source_id} -->|{rel_type}| {target_id}')
    
    # Add class definitions for entity types
    lines.append("")
    lines.append("    classDef agent fill:#3B82F6,stroke:#1e40af,stroke-width:2px")
    lines.append("    classDef skill fill:#10B981,stroke:#059669,stroke-width:2px")
    lines.append("    classDef technology fill:#F59E0B,stroke:#d97706,stroke-width:2px")
    lines.append("    classDef category fill:#8B5CF6,stroke:#7c3aed,stroke-width:2px")
    lines.append("    classDef architecture fill:#EF4444,stroke:#dc2626,stroke-width:2px")
    
    with open(output_path, 'w') as f:
        f.write("\n".join(lines))
    
    print(f"✓ Mermaid diagram exported to: {output_path}")
    return str(output_path)


def export_graphml(graph_structure: Dict[str, Any], output_file: str):
    """Export graph as GraphML (for Cytoscape, Gephi)."""
    nodes = graph_structure["nodes"]
    edges = graph_structure["edges"]
    
    output_path = PROJECT_ROOT / "outputs" / output_file
    output_path.parent.mkdir(exist_ok=True)
    
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<graphml xmlns="http://graphml.graphdrawing.org/xmlns"',
        '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
        '    xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns',
        '     http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">',
        '  <key id="d0" for="node" attr.name="entity_type" attr.type="string"/>',
        '  <key id="d1" for="node" attr.name="category" attr.type="string"/>',
        '  <key id="d2" for="node" attr.name="color" attr.type="string"/>',
        '  <key id="d3" for="edge" attr.name="relation_type" attr.type="string"/>',
        '  <graph id="G" edgedefault="directed">'
    ]
    
    # Add nodes
    for node in nodes:
        name = node["name"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        lines.append(f'    <node id="{node["id"]}">')
        lines.append(f'      <data key="d0">{node["entity_type"]}</data>')
        lines.append(f'      <data key="d1">{node["category"]}</data>')
        lines.append(f'      <data key="d2">{node["color"]}</data>')
        lines.append(f'      <data key="node_name">{name}</data>')
        lines.append('    </node>')
    
    # Add edges
    for edge in edges:
        source_node = nodes[edge["source"]]
        target_node = nodes[edge["target"]]
        rel_type = edge.get("relation_type", "related").replace("&", "&amp;")
        lines.append(f'    <edge source="{source_node["id"]}" target="{target_node["id"]}">')
        lines.append(f'      <data key="d3">{rel_type}</data>')
        lines.append('    </edge>')
    
    lines.append('  </graph>')
    lines.append('</graphml>')
    
    with open(output_path, 'w') as f:
        f.write("\n".join(lines))
    
    print(f"✓ GraphML exported to: {output_path}")
    return str(output_path)


def export_csv(graph_structure: Dict[str, Any], output_file: str):
    """Export graph as CSV files (nodes.csv, edges.csv)."""
    nodes = graph_structure["nodes"]
    edges = graph_structure["edges"]
    
    output_dir = PROJECT_ROOT / "outputs"
    output_dir.mkdir(exist_ok=True)
    
    import csv
    
    # Export nodes
    nodes_path = output_dir / "nodes.csv"
    with open(nodes_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'name', 'entity_type', 'category', 'color', 'memory_text'])
        writer.writeheader()
        for node in nodes:
            writer.writerow({
                'id': node['id'],
                'name': node['name'],
                'entity_type': node['entity_type'],
                'category': node['category'],
                'color': node['color'],
                'memory_text': node['memory_text']
            })
    
    # Export edges
    edges_path = output_dir / "edges.csv"
    with open(edges_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['source_id', 'target_id', 'source_name', 'target_name', 'relation_type'])
        writer.writeheader()
        for edge in edges:
            source_node = nodes[edge["source"]]
            target_node = nodes[edge["target"]]
            writer.writerow({
                'source_id': source_node['id'],
                'target_id': target_node['id'],
                'source_name': source_node['name'],
                'target_name': target_node['name'],
                'relation_type': edge.get('relation_type', 'related')
            })
    
    print(f"✓ CSV files exported:")
    print(f"  - Nodes: {nodes_path}")
    print(f"  - Edges: {edges_path}")
    return str(nodes_path), str(edges_path)


def main():
    import argparse
    import time
    
    parser = argparse.ArgumentParser(description="Visualize Mem0 graph with colorized nodes")
    parser.add_argument("--user-id", default="orchestkit:all-agents", help="Mem0 user ID")
    parser.add_argument("--agent-filter", help="Filter graph to show only memories for specific agent (metadata.agent_name)")
    parser.add_argument("--show-shared", action="store_true", default=True, help="Include shared knowledge (skills, tech, categories) in graph (default: True)")
    parser.add_argument("--no-shared", dest="show_shared", action="store_false", help="Exclude shared knowledge, show only agent-specific memories")
    parser.add_argument("--limit", type=int, help="Limit number of memories to export")
    parser.add_argument("--output", default="mem0-graph-visualization.html", help="Output filename")
    parser.add_argument("--format", choices=["plotly", "networkx", "json", "mermaid", "graphml", "csv"], default="plotly", help="Visualization format")
    parser.add_argument("--cache", action="store_true", help="Use cached graph data if available")
    parser.add_argument("--sample", type=float, help="Sample fraction (0.0-1.0) for large graphs")
    args = parser.parse_args()
    
    try:
        start_time = time.time()
        
        # Check for cached data
        cache_file = PROJECT_ROOT / "outputs" / ".mem0-graph-cache.json"
        graph_data = None
        
        if args.cache and cache_file.exists():
            try:
                cache_age = time.time() - cache_file.stat().st_mtime
                if cache_age < 3600:  # Use cache if less than 1 hour old
                    print("Using cached graph data...")
                    with open(cache_file) as f:
                        graph_data = json.load(f)
            except Exception as e:
                print(f"Warning: Could not load cache: {e}")
        
        # Export graph data if not cached
        if graph_data is None:
            print("Exporting graph data from Mem0...")
            graph_data = export_graph_data(
                args.user_id,
                args.limit,
                agent_filter=args.agent_filter,
                show_shared=args.show_shared
            )
            
            # Save to cache
            if args.cache:
                cache_file.parent.mkdir(exist_ok=True)
                with open(cache_file, 'w') as f:
                    json.dump(graph_data, f, indent=2, default=str)
        
        # Apply sampling if requested
        if args.sample and 0 < args.sample < 1:
            memories = graph_data.get("memories", [])
            sample_size = int(len(memories) * args.sample)
            import random
            graph_data["memories"] = random.sample(memories, min(sample_size, len(memories)))
            print(f"Sampled {len(graph_data['memories'])} memories ({args.sample*100:.0f}%)")
        
        # Build graph structure
        print("\nBuilding graph structure...")
        graph_structure = build_graph_structure(graph_data)
        
        # Progress indicator
        print(f"\nGraph structure:")
        print(f"  Nodes: {graph_structure['node_count']}")
        print(f"  Edges: {graph_structure['edge_count']}")
        
        # Count by entity type
        entity_counts = {}
        for node in graph_structure["nodes"]:
            et = node["entity_type"]
            entity_counts[et] = entity_counts.get(et, 0) + 1
        
        print(f"\nNodes by entity type:")
        for et, count in sorted(entity_counts.items()):
            print(f"  {et}: {count}")
        
        # Warn if graph is large
        if graph_structure['node_count'] > 500:
            print(f"\n⚠ Large graph detected ({graph_structure['node_count']} nodes)")
            print("  Consider using --sample 0.5 for faster rendering")
        
        # Build title with filter info
        title_text = "OrchestKit Plugin Structure - Mem0 Graph Visualization"
        if args.agent_filter:
            title_text += f" (Agent: {args.agent_filter})"
        elif not args.show_shared:
            title_text += " (Agent-Specific Only)"
        
        # Create visualization
        print(f"\nCreating {args.format} visualization...")
        viz_start = time.time()
        
        if args.format == "plotly":
            create_plotly_visualization(graph_structure, args.output, title=title_text)
        elif args.format == "networkx":
            create_networkx_visualization(graph_structure, args.output.replace(".html", ".png"))
        elif args.format == "mermaid":
            export_mermaid(graph_structure, args.output.replace(".html", ".mmd"))
        elif args.format == "graphml":
            export_graphml(graph_structure, args.output.replace(".html", ".graphml"))
        elif args.format == "csv":
            export_csv(graph_structure, args.output)
        else:
            export_json(graph_structure, args.output.replace(".html", ".json"))
        
        elapsed = time.time() - start_time
        viz_elapsed = time.time() - viz_start
        
        print(f"\n✓ Visualization complete!")
        print(f"  Total time: {elapsed:.2f}s")
        print(f"  Visualization time: {viz_elapsed:.2f}s")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
