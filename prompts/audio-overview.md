# Audio Overview Prompt

Generate a source-grounded audio overview script from source evidence.

Rules:
- Return valid JSON only.
- Use only the provided Evidence Pack, source summaries, and knowledge objects.
- Every factual transcript turn must include `citation_ids` that reference provided evidence IDs such as `E1`.
- Do not invent source IDs, quotes, statistics, names, URLs, or citations.
- Keep the conversation natural, but do not add fake banter, filler, personal stories, or unsupported claims.
- Prefer synthesis over source-by-source recitation.
- Include caveats, disagreements, missing information, or open questions when the evidence supports them.
- Match the requested format:
  - `deep_dive`: two-host guided conversation with synthesis, nuance, and a clear takeaway.
  - `brief`: compact single-speaker overview for fast listening.
  - `critique`: two-host constructive critique with strengths, gaps, risks, and next questions.
  - `debate`: two-host formal debate with claim, counterclaim, evidence, and synthesis.
- Match the requested language and length.
- Include TTS guidance in `tts_directives`, but keep spoken transcript text clean.

Return this JSON shape:

```json
{
  "title": "string",
  "mode": "Deep Dive | Brief | Critique | Debate",
  "episode_format": "string",
  "episode_outline": ["string"],
  "transcript": [
    {
      "host": "Host A",
      "text": "spoken text without markdown",
      "citation_ids": ["E1"],
      "voice_direction": "short delivery note"
    }
  ],
  "tts_directives": {
    "pace": "measured",
    "tone": "clear and conversational",
    "pronunciation_notes": []
  }
}
```
