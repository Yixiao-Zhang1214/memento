# Evidence policy

## Evidence levels

### E1: user evidence

Include user-written text, voice transcripts, follow-up answers, corrections,
and explicit metadata statements.

Allow E1 to support events, people, relationships, motives, emotions, personal
meaning, `source_line`, and all other output fields.

### E2: visible evidence

Include only directly visible objects, setting, color, light, physical state,
and observable action.

Allow E2 to support titles, object-first `source_line` values, visible
descriptions, quiet text, and restrained curator notes. Do not use E2 alone to
support identity, relationship, motive, emotion, history, ownership, or
personal meaning.

### E3: authorized metadata

Include user-provided or explicitly authorized date and location. Do not infer
exact time or location from appearance.

### E4: expression controls

Include selected style, requested length, structure, and editing direction.
Allow E4 to change expression only. Never let it add facts.

## Normalize evidence

1. Keep raw text, transcript, follow-up answer, visual observations, and
   metadata separate.
2. Assign stable IDs in source order: `E1-01`, `E1-02`, `E2-01`, and so on.
3. Split claims only when they have different allowed uses.
4. Preserve uncertainty in the evidence text.
5. Record user corrections as authoritative E1 evidence and discard the
   contradicted interpretation.

## Resolve conflicts

Apply this order:

1. Latest explicit user correction
2. Explicit user statement
3. Authorized metadata
4. Directly visible observation
5. Omit unresolved content

Never reconcile a conflict by inventing a third explanation.

## Bind claims

Before returning composed text:

1. Identify every event, person, relationship, location, time, emotion,
   motive, and personal-meaning claim.
2. Bind each claim to evidence IDs.
3. Delete or soften claims with no valid binding.
4. For a `story`, require E1 for personal claims.
5. Bind every person and time fragment in `source_line` to E1/E3.
6. For a `quiet` text, use only E2/E3 and the fact that the user chose to keep
   the moment.
7. Bind the curator note under the same rules as the body.

## Forbidden inference

Do not infer:

- a person's identity, gender, age, job, health, ethnicity, wealth, or
  relationship from appearance;
- that an item was gifted, treasured, kept for years, or still exists;
- that a user is sad, healed, nostalgic, brave, lonely, or growing unless the
  user expresses it;
- an event outside the visible image;
- exact dialogue, weather, location, brand, date, or chronology not supplied.

Do not offer a `careful_infer` escape hatch. If evidence is thin, produce less.

## Audit distinction

The deterministic validator can check bindings and structure, but it cannot
prove that prose is faithful. Perform a semantic evidence audit before running
the script. A passing script result never overrides an unsupported-claim
finding.
