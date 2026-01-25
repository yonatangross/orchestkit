#!/usr/bin/env python3
"""
Webhook receiver for mem0 events.
Handles incoming webhook events and routes them to appropriate handlers.
Usage: ./webhook-receiver.py (typically run as HTTP server endpoint)
"""
import argparse
import json
import sys
from pathlib import Path

# Add lib directory to path
_SCRIPT_DIR = Path(__file__).parent
_LIB_DIR = _SCRIPT_DIR.parent / "lib"
if str(_LIB_DIR) not in sys.path:
    sys.path.insert(0, str(_LIB_DIR))


def process_webhook_event(event_data: dict) -> dict:
    """
    Process incoming webhook event from mem0.
    
    Args:
        event_data: Webhook event payload from mem0
    
    Returns:
        Processing result with action taken
    """
    event_type = event_data.get("event_type", "")
    memory_data = event_data.get("memory", {})
    memory_id = memory_data.get("id") if isinstance(memory_data, dict) else None
    
    result = {
        "processed": True,
        "event_type": event_type,
        "memory_id": memory_id,
        "action": "logged"
    }
    
    # Route to appropriate handler based on event type
    if event_type == "memory.created":
        result["action"] = "sync_to_graph"
        result["message"] = "Memory created - trigger graph sync"
    elif event_type == "memory.updated":
        result["action"] = "trigger_decision_sync"
        result["message"] = "Memory updated - trigger decision sync"
    elif event_type == "memory.deleted":
        result["action"] = "cleanup_graph_entities"
        result["message"] = "Memory deleted - cleanup related graph entities"
    else:
        result["action"] = "logged"
        result["message"] = f"Unknown event type: {event_type}"
    
    return result


def main():
    parser = argparse.ArgumentParser(description="Process mem0 webhook event")
    parser.add_argument("--event", help="JSON event data (or read from stdin)")
    parser.add_argument("--validate-signature", action="store_true", help="Validate webhook signature (not implemented)")
    args = parser.parse_args()

    try:
        # Read event data from argument or stdin
        if args.event:
            event_data = json.loads(args.event)
        else:
            # Read from stdin (for HTTP POST body)
            event_data = json.load(sys.stdin)

        # Validate event structure
        if not isinstance(event_data, dict):
            raise ValueError("Event data must be a JSON object")

        # Process the event
        result = process_webhook_event(event_data)

        print(json.dumps({
            "success": True,
            "result": result
        }, indent=2))

    except json.JSONDecodeError as e:
        print(json.dumps({
            "error": f"Invalid JSON: {str(e)}",
            "type": "JSONDecodeError"
        }, indent=2), file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(json.dumps({
            "error": str(e),
            "type": "ValueError"
        }, indent=2), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "type": type(e).__name__
        }, indent=2), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
