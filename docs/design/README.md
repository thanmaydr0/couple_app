# Us design handoff

Start with [FIGMA_INDEX.md](FIGMA_INDEX.md) and [VERIFICATION.md](VERIFICATION.md). This design-only deliverable is incomplete because Figma Starter blocked further MCP calls. All app code remains unchanged.

Regenerate tokens and exact contrast evidence:

```powershell
python docs/design/build_tokens.py
```

The script uses only Python's standard library. Figma state ledgers preserve node IDs for safe continuation. The QA PNGs show the latest inspected state; they are not proof that the remaining defects have been fixed.
