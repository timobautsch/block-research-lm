# Environment

## Lokale Demo

Für die lokale Demo ist kein externer API-Key nötig. Die App läuft mit deterministischen lokalen Fallbacks.

```bash
fnm use
npm run dev
```

Das Projekt pinnt Node.js über `.node-version` auf `24.17.0`. Node `>=22` ist erforderlich, weil der lokale Auth-Store Node's eingebautes `node:sqlite` nutzt.

## Server-seitige Provider

Provider-Keys werden ausschließlich serverseitig gelesen. Sie werden nicht an den Client gesendet und nicht geloggt.

```bash
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-haiku-latest
ANTHROPIC_ARTIFACT_MODEL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_ARTIFACT_MODEL=
GOOGLE_API_KEY=
GOOGLE_MODEL=gemini-1.5-flash
GOOGLE_ARTIFACT_MODEL=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_VOICE_ID_HOST_A=
ELEVENLABS_VOICE_ID_HOST_B=
ELEVENLABS_MODEL=eleven_v3
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
```

`ELEVENLABS_VOICE_ID_HOST_A` und `ELEVENLABS_VOICE_ID_HOST_B` aktivieren MP3-Rendering für Audio Overview Artefakte. Ohne diese Werte bleibt das Audio Artifact als geprüftes Transcript verfügbar.

## Routing

```bash
DEFAULT_REASONING_PROVIDER=auto
DEFAULT_ARTIFACT_PROVIDER=local
SOURCESTUDIO_ARTIFACT_PROVIDER=
SOURCESTUDIO_AUDIO_SCRIPT_PROVIDER=
DEFAULT_EMBEDDING_PROVIDER=deterministic-local
```

`DEFAULT_REASONING_PROVIDER=auto` wählt den ersten verfügbaren serverseitigen Provider in dieser Reihenfolge:

1. Anthropic
2. OpenAI
3. Gemini
4. Local fallback

Alternativ kann `DEFAULT_REASONING_PROVIDER` auf `local`, `anthropic`, `openai` oder `google` gesetzt werden.
`SOURCESTUDIO_AUDIO_SCRIPT_PROVIDER` steuert nur die Audio-Overview-Script-Erzeugung und akzeptiert dieselben Werte. Ohne Wert folgt sie dem Reasoning-Provider; mit `local` bleibt sie vollständig deterministisch lokal.

Studio-Artefakte nutzen standardmäßig weiter den lokalen deterministischen Generator, damit ein Chat-Provider nicht automatisch zusätzliche Kosten bei jedem Studio-Klick erzeugt. Externe Artefaktgenerierung kann explizit aktiviert werden:

```bash
SOURCESTUDIO_ARTIFACT_PROVIDER=anthropic
# oder:
DEFAULT_ARTIFACT_PROVIDER=auto
```

`SOURCESTUDIO_ARTIFACT_PROVIDER` und `DEFAULT_ARTIFACT_PROVIDER` akzeptieren `local`, `auto`, `anthropic`, `openai` oder `google`. Optionale `*_ARTIFACT_MODEL` Werte überschreiben das Modell nur für die Rolle `artifact_generation`; ohne Override wird das jeweilige normale Provider-Modell verwendet.

## Infrastrukturgrenzen

```bash
DATABASE_URL=
REDIS_URL=
STORAGE_DIR=.data/sourcestudio
```

Die App läuft vollständig lokal und benötigt keine externen Produktivdatenbanken. `DATABASE_URL` und `REDIS_URL` dokumentieren die Produktionsgrenze für Postgres/pgvector und Redis/Queue Worker.

## Sicherheit

- `.env`, `.env.local`, `.data`, generated exports und lokale Logs bleiben aus Git heraus.
- API-Keys bleiben serverseitig.
- Health und Provider Status zeigen nur Konfiguration und aktive Provider-Rolle, keine Secret-Werte.
- Model Runs speichern Provider, Model, Role, Latency, Status und Error ohne Secret-Inhalte.
