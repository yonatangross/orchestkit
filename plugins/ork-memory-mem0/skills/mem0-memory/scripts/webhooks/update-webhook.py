#!/usr/bin/env python3
"""
Update webhook configuration in mem0.
Usage: ./update-webhook.py --webhook-id "wh_123" --url "https://new-url.com" [--name "New Name"] [--event-types '["memory.created"]']
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
from mem0_client import get_mem0_client  # type: ignore  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Update mem0 webhook")
    parser.add_argument("--webhook-id", required=True, help="Webhook ID to update")
    parser.add_argument("--url", help="New webhook URL")
    parser.add_argument("--name", help="New webhook name")
    parser.add_argument("--event-types", help="JSON array of event types")
    parser.add_argument("--api-key", help="Or use MEM0_API_KEY env")
    parser.add_argument("--org-id", help="Or use MEM0_ORG_ID env")
    parser.add_argument("--project-id", help="Or use MEM0_PROJECT_ID env")
    args = parser.parse_args()

    try:
        client = get_mem0_client(
            api_key=args.api_key,
            org_id=args.org_id,
            project_id=args.project_id
        )

        # Build update parameters
        update_params = {}
        if args.url:
            update_params["url"] = args.url
        if args.name:
            update_params["name"] = args.name
        if args.event_types:
            event_types = json.loads(args.event_types)
            if not isinstance(event_types, list):
                raise ValueError("--event-types must be a JSON array")
            update_params["event_types"] = event_types

        if not update_params:
            raise ValueError("At least one of --url, --name, or --event-types must be provided")

        # SDK may have update_webhook method
        if hasattr(client, 'update_webhook'):
            result = client.update_webhook(webhook_id=args.webhook_id, **update_params)
        else:
            raise ValueError("Webhook update not available in current SDK version")

        print(json.dumps({
            "success": True,
            "webhook_id": args.webhook_id,
            "webhook": result
        }, indent=2))

    except ValueError as e:
        print(json.dumps({
            "error": str(e),
            "type": "ValueError"
        }, indent=2), file=sys.stderr)
        sys.exit(1)
    except ImportError as e:
        print(json.dumps({
            "error": str(e),
            "type": "ImportError"
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
