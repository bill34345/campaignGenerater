# Quest JSON Schema

Task 8 generates a strict JSON quest draft. The generator must return structured data that matches this shape, not prose outside the schema.

## Top-level fields

- `title`: non-empty string
- `premise`: non-empty string
- `hook`: non-empty string
- `scenes`: array with `3` to `5` scene objects
- `npcs`: array with at least `1` NPC object
- `encounters`: array with at least `1` encounter object
- `rewards`: array with at least `1` reward object
- `returnToMainPlot`: non-empty string describing how the side quest reconnects to the campaign arc
- `gmSummary`: non-empty string for the GM-facing overview

## Scene object

Each scene is strict JSON with:

- `name`: non-empty string
- `goal`: non-empty string
- `summary`: non-empty string
- `location`: non-empty string
- `conflictType`: one of `social`, `investigation`, `combat`, `exploration`, `mixed`
- `outcomeOptions`: array of one or more non-empty strings

## NPC object

- `name`: non-empty string
- `role`: non-empty string
- `motivation`: non-empty string
- `secret`: non-empty string

## Encounter object

- `name`: non-empty string
- `difficultyTarget`: non-empty string
- `purpose`: non-empty string
- `notes`: non-empty string

## Reward object

- `type`: non-empty string
- `value`: non-empty string

## Validation rules

The route performs schema parsing first, then task-specific validation:

- required top-level text fields must be present
- scene count must stay between `3` and `5`
- at least one NPC must exist
- `returnToMainPlot` must be populated
- the draft must stay anchored to the requested town
- the draft must honor the requested quest type

## Example

```json
{
  "title": "The Bell Below Blackwater",
  "premise": "Blackwater's chapel crypt hums with stolen tide-magic.",
  "hook": "A frantic sexton begs the party to investigate Blackwater before dusk.",
  "scenes": [
    {
      "name": "Market Rumors",
      "goal": "Learn who disturbed the crypt",
      "summary": "The party questions fishers and temple regulars in Blackwater.",
      "location": "Blackwater market square",
      "conflictType": "investigation",
      "outcomeOptions": ["Identify the smuggler route", "Gain the sexton's trust"]
    },
    {
      "name": "Harbor Intercept",
      "goal": "Catch the relic runners",
      "summary": "Suspicious dockhands try to flee with the stolen reliquary.",
      "location": "Blackwater tide docks",
      "conflictType": "combat",
      "outcomeOptions": ["Capture a runner", "Recover the reliquary map"]
    },
    {
      "name": "Crypt Reckoning",
      "goal": "Seal the breach and recover the clue",
      "summary": "The party descends into the flooded crypt beneath Blackwater chapel.",
      "location": "Blackwater chapel crypt",
      "conflictType": "investigation",
      "outcomeOptions": ["Seal the breach", "Recover the cult ledger"]
    }
  ],
  "npcs": [
    {
      "name": "Sister Hale",
      "role": "Sexton",
      "motivation": "Protect Blackwater",
      "secret": "She hid an earlier omen from the council"
    }
  ],
  "encounters": [
    {
      "name": "Dockside chase",
      "difficultyTarget": "medium",
      "purpose": "Pressure the party before the crypt reveal",
      "notes": "Use slippery piers and panicked civilians."
    }
  ],
  "rewards": [
    {
      "type": "information",
      "value": "A ledger tying the smugglers to the cult patron."
    }
  ],
  "returnToMainPlot": "The ledger identifies the cult patron behind the broader campaign threat.",
  "gmSummary": "An investigation-heavy Blackwater quest that exposes a smuggling cell tied to the main cult."
}
```
