# Block Research LM — YouTube-Präsentation & Teleprompter

Stand: 1. Juli 2026

**Ziel des Videos:** Die Zuschauer sollen verstehen, dass NotebookLM kein „Chatbot mit Upload-Button" ist, sondern ein *source-grounded* Research-System. Danach zeigen wir, wie **Block Research LM** dieses Prinzip nachbaut — mit multimodaler Ingestion, Source Blocks, Chunking, echten Embeddings, hybrider Retrieval, Evidence Packs, einem Citation Ledger und Studio-Artefakten.

**Aufbau:** Erst das Prinzip verstehen → dann die Architektur Schicht für Schicht → dazwischen drei Live-Demos in der App. Die Folien sind bewusst knapp; der gesprochene Text steht pro Folie unter `Teleprompter` und ist zusätzlich als Speaker Notes hinterlegt.

**Sprecher-Hinweis:** `▶ SCREENSHARE`-Marker zeigen, wann in die App gewechselt wird.

---

## Slide 01 — Block Research LM

### Folientext
- NotebookLM verstehen — nicht kopieren
- Das Prinzip: Quellen als Autorität
- Die Architektur, Schicht für Schicht
- RAG, Chunking, Evidence — erklärt
- 3 Live-Demos in der App

### Teleprompter
Willkommen. Google NotebookLM ist viral gegangen — die meisten halten es für „ein Chatbot, dem man PDFs gibt". Das ist der Punkt, den ich in diesem Video auseinandernehmen will. Denn das eigentlich Starke an NotebookLM ist nicht das Chatfenster, sondern eine Architektur-Idee: Deine Quellen werden zur einzigen Autorität. Wir kopieren keine Oberfläche Pixel für Pixel. Wir verstehen das Produktprinzip — und bauen es dann selbst nach, als **Block Research LM**. Ich zeige dir das Ganze Schicht für Schicht: wie Quellen reinkommen, wie sie zitierbar werden, wie Retrieval funktioniert, und wie am Ende jede Aussage überprüfbar bleibt. Dazwischen springen wir immer wieder in die echte App. Am Ende weißt du, warum das mehr ist als ein Dokument-Chat — und warum die eigentliche Ingenieurleistung in der *nachprüfbaren* Evidence-Pipeline steckt.

---

## Slide 02 — NotebookLM ist kein Upload-Chatbot

### Folientext
- Das Original
- Du lädst eigene Quellen in ein Notebook
- Gemini arbeitet nur über diesem Quellenraum
- Antworten tragen Inline-Citations zurück zur Stelle
- Studio macht aus demselben Material neue Formate
- Quellen: Google NotebookLM Help [G1], [G3]

### Teleprompter
Fangen wir beim Original an. Der entscheidende Unterschied zu ChatGPT und Co. ist nicht das Modell — es ist der *Arbeitsraum*. Bei einem normalen Chatbot fragst du gegen das halbe Internet und das Gedächtnis des Modells. Bei NotebookLM fragst du gegen genau das, was in deinem Notebook liegt. Google setzt darunter Gemini und legt großen Wert auf klare Inline-Citations — für Genauigkeit, Transparenz und Vertrauen. Diese eine Verschiebung verändert alles: Das Modell wird vom Alleswisser zum Analysten deiner Quellen. Und das ist unser Startpunkt. Wer NotebookLM nachbauen will, muss zuerst diese Quellenbindung bauen — nicht das Chatfenster.

---

## Slide 03 — Die Quellen sind die Autorität

### Folientext
- Das Produktprinzip
- Generischer Chat: klingt plausibel — auch wenn er rät
- Source-grounded: antwortet nur, wenn die Quellen es tragen
- Reicht die Evidence nicht, sagt ein gutes System: Nein
- Weniger Kreativität, mehr Vertrauen

### Teleprompter
Das ganze Versprechen passt in einen Satz: *Die Quellen sind die Autorität.* Ein generischer Chatbot will fast immer hilfreich sein — das fühlt sich gut an, ist aber riskant, weil die Antwort selbst dann überzeugend klingt, wenn sie frei erfunden ist. Ein source-grounded System hat eine andere Pflicht. Es fragt zuerst: Steht in den *aktiven* Quellen genug, um das zu behaupten? Wenn ja, antwortet es — mit Beleg. Wenn nein, muss es sich enthalten. Dieses „Nein, das geben meine Quellen nicht her" ist kein Bug, sondern das wichtigste Feature. Genau das macht so ein System erst brauchbar für Recherche, Lernen und echte Wissensarbeit.

---

## Slide 04 — Vom Upload zum Output

### Folientext
- Der sichtbare Workflow
- Sources: PDFs, Websites, YouTube, Audio, Docs, Slides …
- Chat: Fragen an die aktiven Quellen — mit Citations
- Studio: Audio, Video, Mind Maps, Reports, Quizzes …
- Chat und Studio stehen auf **derselben** Evidence
- Quellen: Google NotebookLM Help [G1], [G2], [G4], [G5]

### Teleprompter
Der Workflow ist bewusst simpel. Erst kommen Quellen rein — Google nennt PDFs, Websites, YouTube-Links, Audiodateien, Google Docs, Slides, Bilder, Markdown, CSV und mehr. Dann arbeitest du im Chat mit genau diesem Material, kannst einzelne Quellen an- und abschalten, und jede Citation führt zurück zur Stelle. Und dann kommt Studio: Aus denselben Quellen entstehen Audio Overviews, Video Overviews, Mind Maps, Reports, Slide Decks, Flashcards, Quizzes. Für die Architektur ist das die wichtigste Lektion des Abends: Chat und Studio dürfen keine zwei getrennten Systeme sein. Beide müssen auf *derselben* Evidence-Schicht stehen — sonst erzählt dir dein Quiz eine andere Wahrheit als dein Chat.

---

## Slide 05 — Audio & Video machen das Prinzip sichtbar

### Folientext
- Der Wow-Moment
- Audio Overview: zwei AI-Hosts diskutieren deine Quellen
- Video Overview: visueller Deep-Dive aus dem Notebook
- Der Trick ist die **Transformation**, nicht die Zusammenfassung
- Ein Quellenraum → viele Ausgabemedien
- Quellen: Google Help [G4], [G5], Google Blog [G6]

### Teleprompter
Bekannt geworden ist NotebookLM vor allem durch die Audio Overviews: zwei AI-Hosts, die deine Quellen wie in einem Podcast durchsprechen. Video Overviews gehen noch weiter und übersetzen dasselbe Material in ein erzähltes, visuelles Format. Und hier steckt der eigentliche Produktkniff — er ist nicht, „dass eine KI zusammenfasst". Der Kniff ist, dass *ein und dieselbe Quellenbasis* in ein völlig neues Medium übersetzt wird: Text wird zu Dialog, Dialog wird zu Video. Merk dir dieses Bild, denn genau das bauen wir gleich nach: ein Notebook ist ein Quellenraum, aus dem beliebig viele Ausgabeformate entstehen — solange sie alle an dieselbe Evidence gebunden bleiben.

---

## Slide 06 — Unser Ziel: Ergebnisparität + mehr Auditierbarkeit

### Folientext
- Block Research LM
- Keine Google-Kopie — ein eigenständiger Technical Slice
- Chat, Studio & Citations laufen über **eine** Pipeline
- Alles wird gespeichert: Retrieval Runs, Evidence Packs, Ledger
- Lokaler Fallback → läuft auch ohne einen einzigen API-Key

### Teleprompter
Damit sind wir bei Block Research LM. Das Ziel ist nicht, Googles Oberfläche zu klonen, sondern *Ergebnisparität*: Quellen importieren, mit ihnen chatten, Belege zeigen, Studio-Artefakte erzeugen — und den ganzen Weg nachvollziehbar machen. Der Extra-Anspruch heißt Auditierbarkeit. Wir speichern nicht nur das Ergebnis, sondern den Weg dorthin: jeden Retrieval Run, jedes Evidence Pack, jeden Citation Ledger. Und weil der ganze Kern deterministische lokale Fallbacks hat, läuft das System end-to-end auch komplett *ohne* externe Provider-Keys — mit lokalen Modellen statt Cloud. Das ist Gold wert für Demos, Tests und Reproduzierbarkeit: Die Pipeline bleibt erklärbar und wiederholbar.

---

## Slide 07 — Live-Demo 1: Der Research Workspace

### Folientext
- ▶ SCREENSHARE
- Links: Sources — der *Scope*, nicht nur eine Dateiliste
- Mitte: Chat gegen die aktiven Quellen
- Rechts: Studio — wiederverwendbare Artefakte
- Topbar: Provider-Status & lokaler Fallback

### Teleprompter
Zeit für die erste Demo. Ich öffne die App und zeige nur die drei Bereiche — nicht mehr. Links die Sources: Das ist keine reine Dateiliste, sondern der *Scope* fürs Retrieval — ich kann Quellen an- und abschalten. In der Mitte der Chat, der immer gegen die aktiven Quellen arbeitet. Rechts das Studio, wo aus denselben Quellen Artefakte entstehen. Ich bleibe bewusst nicht in UI-Details hängen. Die eine Botschaft ist: Das ist ein Notebook-Arbeitsraum — Chat und Studio ziehen aus demselben Wissensbestand. Und oben zeige ich kurz den Provider-Status: Wenn keine Keys gesetzt sind, greift der lokale Fallback, damit die Demo reproduzierbar bleibt.

---

## Slide 08 — Die Architektur ist eine Evidence-Pipeline

### Folientext
- Das Gesamtbild
- React-Frontend & Express-API sind nur die Hülle
- Der Kern ist ein sauberes Datenmodell
- Frage → Retrieval → Evidence Pack → Antwort → Prüfung
- Studio-Artefakte folgen exakt demselben Muster

### Teleprompter
Jetzt zoomen wir aus der Oberfläche raus. Technisch ist Block Research LM eine *Evidence-Pipeline*. Das React-Frontend und die Express-API sind wichtig, aber sie sind nicht der Kern. Der Kern ist ein explizites Datenmodell: Notebooks, Sources, Source Blocks, Chunks, Embeddings, Knowledge Objects, Retrieval Runs, Evidence Packs, Citation Ledgers, Artifact Jobs, Model Runs. Diese Objekte sorgen dafür, dass eine Antwort eben *nicht* als unprüfbarer Text aus dem Modell fällt. Eine Frage wird erst retrieved, dann in ein Evidence Pack übersetzt, dann vom Model Router beantwortet und danach vom Citation Verifier geprüft. Und das Beste: Studio-Artefakte laufen durch genau dieselbe Kette. Merk dir diesen Ablauf — die nächsten Folien gehen ihn Schritt für Schritt durch.

---

## Slide 09 — Ingestion: viele Quellen, ein Format

### Folientext
- Die Source-Pipeline
- 10 Quelltypen → alles wird zu **Markdown**
- PDF (unpdf) · Bilder (GPT-Vision, OCR) · Audio & Video (Deepgram)
- YouTube (yt-dlp) · Website-Crawler · DOCX · Google Docs · Notes
- Danach interessiert nicht mehr die Herkunft, sondern die Struktur

### Teleprompter
Der erste technische Schritt ist Ingestion — und hier ist der Trick: *alles wird auf eine gemeinsame Markdown-Spur normalisiert.* Block Research LM nimmt zehn Quelltypen. PDFs werden mit der Bibliothek unpdf extrahiert. Bilder liest ein OpenAI-Vision-Modell — es transkribiert Text und beschreibt sogar Diagramme, damit ein Bild durchsuchbar wird. Audio und Video werden von Deepgram transkribiert, nachdem ffmpeg sie normalisiert hat. YouTube-Transkripte holt yt-dlp. URLs werden zu sauberem Markdown gelesen oder als ganze Website gecrawlt; dazu DOCX, Google Docs, Text und Notes. Aber Hochladen allein ist nicht der Punkt — die *Normalisierung* ist es. Jede Quelle wird zu einem einheitlichen Dokument und in Source Blocks zerlegt. Ab hier arbeitet das System nicht mehr mit einer rohen Datei, sondern mit strukturierten Einheiten — die Grundlage für saubere Citations.

---

## Slide 10 — Source Blocks: die kleinste zitierbare Einheit

### Folientext
- Provenance
- Jeder Block kennt: Block-ID, Source-ID, Heading-Pfad, Position
- Citations zeigen auf konkrete Blöcke — nicht auf Dateinamen
- Klick auf den Beleg → App hebt den Block hervor
- Aus einem „dekorativen Chip" wird ein Navigationsanker

### Teleprompter
Source Blocks sind die kleinste Einheit, auf die wir später verlässlich zeigen wollen. Jeder Block kennt seine Source-ID, seine eigene stabile ID, den Heading-Pfad, Zeichenbereiche und Platzhalter für Seiten oder Zeitstempel. Klingt nach einem Detail, ist aber der Unterschied zwischen Spielzeug und Werkzeug. Viele einfache PDF-Chatbots zitieren nur „Dokument, Seite 12". Block Research LM zeigt auf den *konkreten Block*. Dadurch wird eine Citation nicht bloß ein hübscher Chip, sondern ein Navigationsanker: Klickst du auf den Beleg, öffnet die App genau die Stelle und hebt sie hervor. Das ist der Moment, in dem „Vertrauen" von einer Behauptung zu etwas Klickbarem wird.

---

## Slide 11 — Chunking: Kontext gegen Präzision

### Folientext
- Die RAG-Grundlage
- Zu große Chunks → Retrieval wird unscharf
- Zu kleine Chunks → Bedeutung & Kontext gehen verloren
- ~650 Tokens mit Overlap + Heading-Kontext
- Jeder Chunk trägt seine Herkunft (Source, Blocks, Position) mit

### Teleprompter
Jetzt zu RAG — Retrieval-Augmented Generation. Der Chunker entscheidet, wie Wissen in abrufbare Häppchen geschnitten wird, und das ist ein Balanceakt. Ist ein Chunk zu groß, enthält er zu viele Themen und die Suche wird unscharf. Ist er zu klein, verliert er Kontext und das Modell bekommt zusammenhanglose Satzfetzen. Deshalb schneiden wir auf rund 650 Tokens, mit etwas Overlap an den Rändern und mitgeführtem Heading-Kontext, damit an den Schnittstellen nichts verlorengeht. Wichtig: Ein Chunk ist nie nur Text — er ist Text *plus Herkunft*: Source, Block-IDs, Heading-Pfad, Position. Genau diese Struktur erlaubt es dem Retrieval, präzise zu suchen, ohne die Zitierbarkeit wegzuwerfen.

---

## Slide 12 — Embeddings: Bedeutung suchbar machen

### Folientext
- Der Index
- Jeder Chunk wird zu einem semantischen Vektor
- Lokal & offline: multilingual-e5-small (384-dim)
- Cloud-Upgrade: Voyage / OpenAI — ein Flag entfernt
- Gespeichert in Supabase **pgvector** (mit In-Memory-Fallback)

### Teleprompter
Nach dem Chunking braucht das System eine Suche, die nicht nur exakte Wörter findet, sondern *Bedeutung*. Dafür werden Chunks zu Embeddings — Vektoren, bei denen semantisch Ähnliches nah beieinanderliegt. In der aktiven Konfiguration läuft dafür ein lokales, mehrsprachiges Modell direkt auf der Maschine: multilingual-e5-small, 384 Dimensionen — kostenlos, offline, ohne Rate-Limits. Für höhere Qualität sind Voyage und OpenAI als Cloud-Embeddings verdrahtet; das ist ein einziges Environment-Flag. Die Vektoren liegen in Supabase Postgres mit der pgvector-Erweiterung, damit die Ähnlichkeitssuche skaliert — und fällt sauber auf eine In-Memory-Suche zurück, wenn keine Datenbank gesetzt ist. Und eins ist wichtig: Vektorsuche ersetzt Stichwortsuche nicht. Gute Retrieval-Systeme *kombinieren* beides.

---

## Slide 13 — Retrieval ist zuerst eine Auswahlmaschine

### Folientext
- Hybrid Retrieval
- Nur aktive Quellen kommen in den Scope
- Query wird analysiert & umgeschrieben
- Signale: Keyword · BM25 · Vektor · Heading/Entity — dann MMR
- Ergebnis ist keine Antwort, sondern **Evidence**

### Teleprompter
Ein verbreiteter Denkfehler: „RAG heißt, das Modell kennt jetzt die Dokumente." Nein — RAG ist zuerst eine *Auswahlmaschine*. Bei jeder Frage legt die App erst den Scope fest: Welche Quellen sind aktiv? Dann schreibt sie die Frage in ein paar Varianten um. Und dann bewertet der Retriever jeden Kandidaten-Chunk über *mehrere* Signale gleichzeitig — Stichwort-Overlap, BM25, semantische Vektorähnlichkeit, Heading- und Entity-Treffer — und diversifiziert das Ergebnis mit einem MMR-Schritt, damit nicht fünfmal derselbe Absatz drinsteht. Erst daraus entsteht die Evidence, die ans Modell geht. Diese Trennung ist der ganze Punkt: Retrieval entscheidet, *was überhaupt* in den Kontext darf. Das Modell formuliert nur noch auf Basis dieser Auswahl.

---

## Slide 14 — Das Evidence Pack: der Vertrag mit dem Modell

### Folientext
- Grounding
- Strukturierte Evidence Items: ID, Quote, Source Reference, Support
- Der Prompt darf **nur** IDs aus dem Pack benutzen
- Reicht die Evidence nicht → Abstention
- Chat und Studio nutzen denselben Vertrag

### Teleprompter
Das Evidence Pack ist der *Vertrag* zwischen Retrieval und Generierung. Es sagt dem Modell nicht: „Hier ist viel Kontext, mach mal." Es liefert strukturierte Evidence Items — jedes mit ID, wörtlichem Zitat, Source Reference und Support-Typ. Der Prompt verlangt dann klare Regeln: Antworte *nur* aus diesem Pack. Benutze nur gültige Evidence- und Citation-IDs. Erfinde keine Quellen, keine Zahlen. Und wenn die Evidence nicht reicht — enthalte dich. Das ist ein viel härteres Muster als ein frei zusammengeklebter Kontextblock. Und weil die Studio-Artefakte *denselben* Vertrag benutzen, entstehen Report, Quiz oder Slide-Deck nie aus einer anderen Wahrheit als der Chat.

---

## Slide 15 — Live-Demo 2: Grounded Chat & Abstention

### Folientext
- ▶ SCREENSHARE
- Frage in der Quelle: „What's the core difference to a generic PDF chatbot?"
- Zeige Citation-Chips + hervorgehobenen Source Block
- Gegenfrage: „What's the weather in Berlin tomorrow?"
- Zeige: die App **enthält sich** ohne Evidence

### Teleprompter
Zweite Demo — und die ist der Kern. Ich stelle zuerst eine Frage, die die Quellen beantworten können: „Was ist der zentrale architektonische Unterschied zu einem generischen PDF-Chatbot?" Dann zeige ich, was passiert: Citation-Chips in der Antwort, die zugehörigen Citation-Cards, und der hervorgehobene Source Block. Der Punkt ist nicht, dass die Antwort plausibel ist — der Punkt ist, dass sie *rückführbar* ist. Und dann stelle ich bewusst eine Frage außerhalb der Quellen: „Wie wird morgen das Wetter in Berlin?" Ein gutes System rät hier nicht. Es sagt: Das tragen die aktiven Quellen nicht. Diese Enthaltung — die Abstention — ist genau das Verhalten, das wir sehen wollen. Vertrauen entsteht dort, wo ein System auch mal Nein sagt.

---

## Slide 16 — Der Citation Ledger prüft nach der Antwort

### Folientext
- Verification
- Antwort wird in einzelne Claims zerlegt
- Jeder Claim wird gegen seine zitierte Evidence geprüft
- Nicht gestützte Claims werden entfernt/markiert
- Der Audit bleibt als Ledger gespeichert

### Teleprompter
Nach der Generierung ist die Arbeit noch nicht vorbei — und das ist ungewöhnlich. Wir vertrauen dem Modell nämlich *nicht* blind. Der Citation Verifier zerlegt die Antwort in einzelne Claims und prüft für jeden: Trägt das angegebene Zitat diese Aussage wirklich? Im lokalen Slice passiert das deterministisch über Token-Overlap, mit klaren Klassen — supported, partially supported, unsupported, not checkable. Das ist kein perfekter semantischer Richter, aber es ist schnell, kostenlos, testbar und transparent. Nicht gestützte Claims fliegen aus der final angezeigten Antwort raus. Und der ganze Vorgang bleibt als Citation Ledger gespeichert — man kann also im Nachhinein sehen, welche Aussage belegt war und welche nicht. Das ist der Unterschied zwischen „klingt richtig" und „ist geprüft".

---

## Slide 17 — Der Knowledge Layer macht das Notebook wiederverwendbar

### Folientext
- Strukturiertes Wissen
- Pro Quelle: Summary, Claims, Entities, Dates, Numbers, Risks
- Pro Notebook: Topic Map, Connections, Contradictions, Fragen
- Artefakte brauchen mehr als den Top-Chunk zur Frage
- Chat & Studio greifen auf dieselbe Wissensschicht

### Teleprompter
Neben den Chunks gibt es eine zweite Ebene: den Knowledge Layer. Pro Quelle extrahiert die Engine Summaries, Section Summaries, Claims, Entities, Daten, Zahlen, Risiken und offene Fragen. Pro Notebook entstehen eine Gesamt-Summary, eine Topic Map, ein Entity-Index, Verbindungen, Widersprüche, vorgeschlagene Fragen und Artefakte. Warum der Aufwand? Weil ein Notebook mehr sein soll als eine Suchmaschine — nämlich ein *strukturierter Wissensraum*. Ein Report, eine Mind Map oder ein Quiz braucht oft nicht den einen Top-Chunk zur aktuellen Frage, sondern verdichtetes, verknüpftes Wissen über die ganze Quelle. Genau das liefert diese Schicht — und Chat wie Studio greifen darauf zu.

---

## Slide 18 — Studio: viele Outputs, eine Evidence

### Folientext
- Artifacts
- Report · Mind Map · Flashcards · Quiz · Data Table · Slide Deck
- Audio Overview (ElevenLabs, zwei Stimmen → MP3)
- Video-Storyboard · Infographic (gpt-image) · YouTube-Kit
- Jedes Artefakt trägt Source References — der Server hängt sie an

### Teleprompter
Und jetzt die Outputs — der Teil, der NotebookLM so produktiv wirken lässt. Block Research LM erzeugt Reports, Mind Maps, Flashcards, Quizzes, Data Tables und Slide Decks. Die Audio Overview schreibt das Modell als Zwei-Host-Dialog, und ElevenLabs rendert daraus in *einem* Call eine echte MP3 mit zwei Stimmen. Dazu Video-Storyboards, Infografiken und ein komplettes YouTube-Kit mit Titel und Thumbnail. Aber das Entscheidende ist immer dasselbe: die gemeinsame Evidence-Basis. Ein Artefakt ist keine hübsche freie Modellantwort — es entsteht aus einem Retrieval Run, bekommt ein Evidence Pack, und die Citations hängt der *Server* an, nicht das Modell. Dadurch kann man später prüfen, aus welchen Quellen ein Quiz, eine Slide oder ein Audio-Skript entstanden ist.

---

## Slide 19 — Live-Demo 3: Artefakte erzeugen & prüfen

### Folientext
- ▶ SCREENSHARE
- Erzeuge einen Report oder ein Quiz
- Öffne Vorschau + Source References
- Optional: Mind Map oder Slide Deck
- Botschaft: Studio ist **nicht** vom Chat getrennt

### Teleprompter
Dritte Demo — jetzt das Studio. Ich erzeuge zum Beispiel einen Report oder ein Quiz. Wichtig ist nicht nur das fertige Ergebnis, sondern der *Weg*: Der Job startet, Evidence wird geholt, das Artefakt erscheint, und die Source References bleiben sichtbar. Wenn Zeit ist, zeige ich noch eine Mind Map oder ein Slide Deck. Und ich sage dabei ganz explizit den einen Satz: Studio ist kein zweites System neben dem Chat — es benutzt dieselbe Pipeline. Das ist die Architekturentscheidung, die am Ende Qualität und Vertrauen trägt: Wenn ein Output schlecht ist, kann ich am Evidence Pack oder am Retrieval Run ansetzen — nicht bloß am Prompt herumraten.

---

## Slide 20 — Der Model Router verhindert Lock-in

### Folientext
- Der Model Layer
- Rollen statt Anbieter: Grounded Answer, Verification, Artifacts …
- Claude (Anthropic) primär · OpenAI · Gemini — optional, serverseitig
- Ohne Keys bleibt der lokale Fallback aktiv
- Provider-Output wird als JSON validiert — sonst Fallback

### Teleprompter
Ein kurzer Blick auf den Model Layer. Der Model Router trennt *Rollen* von konkreten Anbietern. Grounded Answer, Citation Verification, Artifact Generation, Summarization, Extraction — das sind eigene Aufgaben, keine Modellnamen. In der App laufen Chat und Artefakte primär über Anthropic Claude, mit OpenAI und Gemini als optionalen serverseitigen Pfaden, sobald die Keys gesetzt sind. Ohne Keys übernimmt der deterministische lokale Fallback. Das ist nicht nur bequem — es schützt vor Lock-in und vor ungeplanten Kosten in Demos. Und jeder Provider-Output wird als JSON *validiert*: Liefert ein Anbieter kaputte Struktur, fällt die App sauber auf den lokalen Generator zurück und speichert den Model Run trotzdem transparent. Jede Anfrage läuft übrigens über pures HTTP — kein Vendor-SDK dazwischen.

---

## Slide 21 — Die Trade-offs sind bewusst gewählt

### Folientext
- Engineering-Ehrlichkeit
- Local-first: sofort demo-fähig — noch nicht auf Prod-Skala getrimmt
- Lokale Embeddings: reproduzierbar — Voyage ist ein Flag für mehr Qualität
- Lexical Verifier: transparent & günstig — erkennt Paraphrasen schwächer
- Strikte JSON-Verträge: weniger kreativ — dafür validierbar & auditierbar

### Teleprompter
Zu einer technischen Präsentation gehört Ehrlichkeit über die Trade-offs — sonst glaubt man dir den Rest auch nicht. Local-first ist stark für Demos, Tests und Interviews, ersetzt aber noch keine voll ausgebaute Storage- und Queue-Infrastruktur. Die lokalen Embeddings machen das System reproduzierbar und kostenlos, sind aber nicht die Qualitätsklasse von Voyage — das ist bewusst ein Flag entfernt. Der Token-Overlap-Verifier ist transparent und unit-testbar, erkennt Paraphrasen aber schlechter als ein starker semantischer Judge. Und die strikten JSON-Verträge begrenzen die kreative Freiheit — dafür sind alle Artefakte validierbar. Das ist der rote Faden: Erst zeigen, dass die *Architektur* stimmt. Dann skalieren. Nicht umgekehrt.

---

## Slide 22 — Takeaway: NotebookLM ist ein Architekturprinzip

### Folientext
- Der Abschluss
- **Sources → Evidence → Verified Output**
- Der Wert liegt nicht im Chatfenster, sondern im prüfbaren Wissensraum
- Block Research LM zeigt den Weg: lokal, source-grounded, end-to-end

### Teleprompter
Und damit schließt sich der Kreis zum Anfang. NotebookLM ist nicht deshalb spannend, weil es ein Chatfenster mit Upload-Button hat. Es ist spannend, weil es ein Architekturprinzip sichtbar macht: *Sources werden zu Evidence, und Evidence wird zu geprüften Outputs.* Block Research LM zeigt genau diesen Weg als eigenständigen, lokalen Slice — end-to-end: Wir importieren Quellen, machen sie zitierbar, chunken sie, embedden sie, retrieven Evidence, generieren Antworten und Artefakte, prüfen die Citations und speichern den Audit Trail. Wenn du nur einen Satz aus diesem Video mitnimmst, dann diesen: Das ist kein Dokument-Chat. Das ist ein source-grounded Research-System — und das Vertrauen darin entsteht nicht aus dem Modell, sondern aus der Architektur. Danke fürs Zuschauen.

---

## Quellen

- [G1] Google Help — Learn about NotebookLM: https://support.google.com/notebooklm/answer/16164461?hl=en
- [G2] Google Help — Add or discover new sources: https://support.google.com/notebooklm/answer/16215270?hl=en
- [G3] Google Help — Use chat in NotebookLM: https://support.google.com/notebooklm/answer/16179559?hl=en
- [G4] Google Help — Generate Audio Overview: https://support.google.com/notebooklm/answer/16212820?hl=en
- [G5] Google Help — Generate Video Overviews: https://support.google.com/notebooklm/answer/16454555?hl=en
- [G6] Google Blog — Video Overviews and Studio upgrades: https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-video-overviews-studio-upgrades/
- [P1] Projekt — README.md, ARCHITECTURE.md, DEMO_SCRIPT.md

## Demo-Fragen

- **Grounded Chat:** `What is the core architectural difference between Block Research LM and a generic PDF chatbot?`
- **Abstention:** `What will the weather be in Berlin tomorrow?`
