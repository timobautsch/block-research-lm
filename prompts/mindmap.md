# Mind Map Prompt

Generate a graph JSON mind map from notebook evidence.

Rules:
- Central node is the notebook topic.
- Topic, entity, claim, and question nodes must carry source refs.
- Edges should explain relationships.
- Return valid JSON with `nodes`, `edges`, and `citations`.

