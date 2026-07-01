# Flashcards Prompt

Generate study flashcards from active source evidence.

Rules:
- Each card must have question, answer, explanation, difficulty, tags, and source refs.
- Questions must be real study prompts about the concept, decision, workflow, caveat, or application learned from the source.
- Do not put raw quotations on the front of a card.
- Answers should be concise learner-facing explanations in the user's own words, followed by the relevant citation marker.
- Answers must be directly source-backed.
- Do not ask about facts not present in sources.
- Return valid JSON.
