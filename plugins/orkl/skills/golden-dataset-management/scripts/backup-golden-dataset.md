---
name: backup-golden-dataset
description: Backup golden dataset with timestamped filename. Use when backing up test datasets.
user-invocable: true
argument-hint: [dataset-name]
---

Backup golden dataset: $ARGUMENTS

## Backup Context (Auto-Detected)

- **Timestamp**: !`date +%Y%m%d-%H%M%S`
- **Dataset Location**: !`find . -type d -name "*golden*" -o -name "*dataset*" 2>/dev/null | head -3 || echo "Not detected"`
- **Python Version**: !`python --version 2>/dev/null || echo "Python 3.x"`
- **Backup Directory**: !`pwd`

## Backup Script

```python
"""
Backup golden dataset: $ARGUMENTS

Generated: !`date +%Y-%m-%d`
Timestamp: !`date +%Y%m%d-%H%M%S`
"""

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path

# Configuration
BACKUP_DIR = Path("data/backups")
BACKUP_FILE = BACKUP_DIR / f"$ARGUMENTS-!`date +%Y%m%d-%H%M%S`.json"

async def backup_dataset():
    """Backup golden dataset."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    
    # Your backup logic here
    backup_data = {
        "dataset": "$ARGUMENTS",
        "timestamp": !`date -u +"%Y-%m-%dT%H:%M:%SZ"`,
        "version": "1.0",
        "data": []  # Add your data here
    }
    
    with open(BACKUP_FILE, "w") as f:
        json.dump(backup_data, f, indent=2)
    
    print(f"✅ Backup created: {BACKUP_FILE}")

if __name__ == "__main__":
    asyncio.run(backup_dataset())
```

## Usage

1. Review detected dataset location above
2. Customize backup logic for your data structure
3. Run: `python backup_script.py`
