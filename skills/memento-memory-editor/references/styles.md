# Styles

Use style to change diction and structure, never facts. Apply evidence and tone
safety before a requested style.

## `truthful`

Use natural, concrete Chinese close to the user's wording.

- Prefer plain verbs and specific details.
- Keep emotion behind facts.
- Curator note: observant and restrained.

Avoid diary clichés, advertising language, and decorative metaphors.

## `private_label`

Write like a label for a private collection.

- Name the object or moment clearly.
- Use concise provenance and explanation.
- Curator note: slightly formal, still personal.

Avoid museum parody, bureaucratic jargon, and false dates or catalog numbers.

## `light_poetic`

Use one limited image or metaphor when supported by visible or user evidence.

- Keep factual sentences as the backbone.
- Prefer one clean image to multiple flourishes.
- Curator note: gentle and image-led.

Avoid turning ordinary input into grand symbolism.

## `dry_humor`

Use understated humor already compatible with the user's attitude.

- Let factual contrast carry the humor.
- Keep the user and other people respected.
- Curator note: one light observation, not a punchline.

Avoid mockery, internet meme language, forced jokes, and humor in grief unless
the user introduced it.

## `fantasy_archive`

Provide compatibility with the earlier Memento concept.

- Allow light terms such as “档案”, “证物”, or “归还物”.
- Keep all real-world facts unchanged.
- Curator note: archival framing with low fantasy intensity.

Avoid adding fictional institutions, dates, events, powers, or lore.

## User-supplied references

When a user names an author, artist, publication, or work:

1. Extract high-level features that the user appears to want.
2. State those features in `style_features`.
3. Write an original result using those general features.
4. Do not copy signature phrases, distinctive passages, or claim exact
   imitation.

Example conversion:

“写得像某位以朴素、冷静叙述著称的作者”

becomes:

```json
{
  "style_features": [
    "朴素用词",
    "冷静叙述",
    "短句",
    "用日常细节承载情绪"
  ]
}
```
