# Tools Directory

This directory contains Python scripts for deterministic execution.

## Guidelines

- Each tool should have a single, clear responsibility
- Tools should be testable and reusable
- API credentials come from `.env`
- Error handling should be explicit and informative
- Tools should work independently (no tight coupling)

## Naming Convention

Use descriptive names that indicate what the tool does:
- `scrape_single_site.py` - Scrapes data from a website
- `export_to_sheets.py` - Exports data to Google Sheets
- `process_data.py` - Transforms data format

## Template

```python
#!/usr/bin/env python3
"""
Tool Name: [Brief description]
Purpose: [What this tool does]
Inputs: [What it requires]
Outputs: [What it produces]
"""

import os
from dotenv import load_dotenv

load_dotenv()

def main():
    # Your implementation here
    pass

if __name__ == "__main__":
    main()
```
