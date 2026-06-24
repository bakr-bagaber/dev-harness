# T13 — Status Command Enhancements

## What changed in `cli/commands/status.mjs`

| Field | Source | Behavior |
|-------|--------|----------|
| `project` | `basename(targetDir)` | Directory name |
| `currentFeature` | `feature_list.json` via `getNextFeature()` | Next incomplete feature (`passes=false`). When no `feature_list.json` exists, `loadFeatureList()` returns a default with "Feature 1" — never null while in a feature-iterate phase |
| `gateStatus` | `runChecks()` from gates.mjs | `"disabled"` / `"pass"` / `"fail"` |
| `checksPassing` | `runChecks().checks.filter(c => c.pass).length` | Live count |
| `checksTotal` | `runChecks().checks.length` | Live count |
| `recentLessons` | `readLessons().slice(-3)` | Last 3, each is `{date, author, text}` object |
| `nextAction` | Context-aware logic | Dynamic: `"Run: harness-dev phase plan"`, `"Run: harness-dev validate"`, `"Run: harness-dev init"` |

## JSON output contract

```json
{
  "command": "status",
  "project": "my-app",
  "stack": "node",
  "mode": "copilot",
  "currentPhase": "define",
  "currentFeature": "Feature 1",
  "gateStatus": "fail",
  "checksPassing": 1,
  "checksTotal": 3,
  "recentLessons": [
    {"date": "2026-06-19", "author": "Hermes", "text": "First lesson"},
    {"date": "2026-06-19", "author": "User", "text": "Second lesson"}
  ],
  "nextAction": "Run: harness-dev phase plan"
}
```

## Human output format

```
═══ dev-harness Status ═══
Project:          my-app
Stack:            Node.js
Mode:             Copilot

Current Phase:    DEFINE
Current Feature:  Feature 1 (feature-001)
Gate Status:      failing — 1/3 checks passing

Last 2 lesson(s):
  2026-06-19 | First lesson
  2026-06-19 | Second lesson

  Run: harness-dev phase plan
```

## Graceful degradation

- No `harness-config.json` → shows defaults, `nextAction: "Run: harness-dev init"`
- No `feature_list.json` → `loadFeatureList()` returns default with "Feature 1" (not null)
- All features passing → `currentFeature: null`
- Gates disabled → `gateStatus: "disabled"`, `checksPassing: 0`, `checksTotal: 0`
- No `progress.md` → `recentLessons: []`
