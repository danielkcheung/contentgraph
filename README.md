# ContentGraph

Map the concept structure your content is missing.

**[Live demo →](https://danielkcheung.com/try-contentgraph)**

---

## How it works

ContentGraph takes the HTML source or plain text of a piece of content and runs a two-phase analysis pipeline using Claude (`claude-sonnet-4-20250514`):

1. **Phase 1 — Extract & Observe** — extracts the main text, classifies the content, and maps every concept present along with the relationships between them
2. **Phase 2 — Propose & Guide** — builds the ideal explanation framework for the topic and audience, then generates specific writing guidance to close the gap

Results are rendered as two interactive, force-directed knowledge graphs and a structured writing guidance panel.

---

## Getting started

**Prerequisites:** Node 18+, an [Anthropic API key](https://console.anthropic.com/)

```bash
git clone https://github.com/danielkcheung/contentgraph.git
cd contentgraph
npm install
npm run dev
```

Open `http://localhost:3000`, enter your API key, and paste the HTML source of any page (`Cmd+U` / `Ctrl+U` in browser) or plain text into the input.

Your API key is stored in `sessionStorage` only. It is sent to the Next.js API route on your own server, which then forwards it to Anthropic — it is never stored, logged, or used for anything else.

---

## Analysis model

### Content extraction

Before analysis begins, the main content is extracted from the input:

- **HTML input** — the parser strips `<nav>`, `<header>`, `<footer>`, `<script>`, `<style>`, `<aside>`, `<form>`, `<noscript>`, `<template>`, `<iframe>`, `<figure>`, and `<figcaption>`, then extracts text from `<main>`, falling back to `<article>`, then to all `<p>` tags if neither is present
- **Text input** — passed through directly

The extracted text is split into sentences, numbered, and passed to Phase 1 alongside the full text to enable evidence extraction tied to specific passages.

### Phase 1 — Classify & Observe

Phase 1 produces an observed graph of the content as it currently exists. It runs as a single Claude API call.

#### Step 1: Classification

The model identifies the content's explanatory context:

| Field | What it captures |
|---|---|
| `anchorType` | Whether the content explains a named thing (`entity`), a mechanism or process (`process`), or a comparison or decision (`comparison_or_decision_topic`) |
| `primaryAnchor` | The specific concept being explained |
| `inferredTopic` | The subject matter in one short phrase |
| `inferredAudience` | Who the content is written for, stated specifically |
| `inferredGoal` | What the reader is trying to accomplish |
| `inferredFormat` | The content format: tutorial, overview, guide, reference, comparison article, etc. |
| `inferredDepth` | How deep the explanation goes: introductory, intermediate, or comprehensive |

The anchor concept is the root of the entire analysis. If it is misidentified, both graphs will target the wrong topic.

#### Step 2: Concept mapping

Every concept present in the content is identified and assigned:

| Field | What it captures |
|---|---|
| `explanatoryRole` | The function this concept serves in the explanation: the main subject, a prerequisite, an output, a mechanism, a constraint, a contrast, etc. |
| `integrationState` | How well the concept is developed (see below) |
| `mentionCount` | Approximate frequency in the text |
| `evidence` | 1–2 direct quotes from the text where the concept appears |
| `definitionSentence` | The single sentence that most clearly introduces the concept — an exact quote, never paraphrased |
| `namingVariants` | Only present when `integrationState` is `naming_inconsistent` — the different labels used for the same concept |

Integration states:

| State | Meaning |
|---|---|
| `well_integrated` | Mentioned multiple times with explicit relationships — clearly developed |
| `weakly_integrated` | Present but underdeveloped — thin coverage, vague, or mentioned once without context |
| `underexplained` | Important for understanding the topic but insufficiently explained given its role |
| `naming_inconsistent` | Referred to with multiple different names or labels that are never reconciled |

#### Step 3: Relationship mapping

Relationships between observed concepts are extracted as directed edges:

- `label` — a short verb phrase: "uses", "requires", "produces", "is a type of", "affects", "constrains", "contrasts with", "is part of"
- `isExplicit` — `true` if the relationship is directly stated in the text, `false` if strongly implied but not stated

A high proportion of implied relationships can indicate that the content mentions concepts without properly connecting them in prose.

#### Step 4: Question coverage

Eight standard explanatory questions are evaluated against the content. For each, the model returns whether it is covered and, if so, the single most relevant sentence from the text as evidence:

| Question | What it tests |
|---|---|
| `whatIsIt` | Does the content define the concept clearly for a first-time reader? |
| `howDoesItWork` | Does the content explain the mechanism or logic by which the concept operates? |
| `whatDoesItDependOn` | Does the content identify what the concept requires or presupposes? |
| `whatDoesItAffectOrProduce` | Does the content describe what the concept changes, produces, or results in? |
| `whoInteractsWithIt` | Does the content identify the people, systems, or roles that use or are affected by it? |
| `whatConstraintsMatter` | Does the content explain limits, rules, edge cases, or conditions? |
| `whatAlternativesOrDistinctionsMatter` | Does the content compare this concept to related or competing approaches? |
| `whatExampleGroundsIt` | Does the content provide a concrete instance that makes the concept tangible? |

Unanswered questions feed directly into Phase 2 as inputs to the writing guidance prompt.

### Phase 2 — Framework & Guidance

Phase 2 runs as two sequential Claude API calls.

#### Call 1: Explanation framework

The model builds the minimal complete explanation framework for the topic and audience — every concept and relationship that should be present in a thorough treatment of this subject. This is the Proposed Graph.

Each concept in the framework is assigned:

| Field | Values | Meaning |
|---|---|---|
| `priority` | `essential` | Understanding fails without this concept |
| | `important` | Significantly aids understanding |
| | `useful` | Enriches depth but is not required |
| `basis` | `observed_in_text` | The concept was already in the content |
| | `strong_topic_inference` | Clearly needed for this topic and audience, but missing |
| | `optional_enrichment` | Adds depth; not required for basic understanding |
| `alreadyPresent` | `yes` | Well covered in the existing content |
| | `partial` | Present but underdeveloped |
| | `no` | Not in the content |

Every non-anchor concept is required to appear in at least one relationship in the framework. Concepts with no edges are disconnected from the graph and excluded. A fallback wiring step connects any remaining isolated concepts directly to the anchor using their `relationshipToAnchor` label.

#### Call 2: Writing guidance

The model takes the explanation framework and the question coverage results and produces writing guidance grounded in the specific concepts and relationships of the framework. Generic advice is explicitly excluded from the prompt.

Guidance is structured into four sections:

| Section | What it contains |
|---|---|
| `summary` | 2–3 sentences naming the primary topic and its most important coverage gaps, referencing specific concept labels |
| `toAdd` | Up to 5 items for concepts in the framework not yet in the content, ordered by priority. Each item has an instruction and an example sentence. |
| `toClarify` | Up to 5 items for concepts already present but weakly explained. Each has an instruction and an example sentence. |
| `toMakeExplicit` | Up to 5 items for relationships that are implied or absent. Each names the exact connection and shows how to phrase it. |
| `sentenceGuidance` | Up to 5 multi-concept cards showing how to sequence or connect 2–4 related concepts in prose. Each includes a concrete example sentence. |

Hovering a node on the Proposed Graph highlights the sentence guidance cards that involve that concept.

Writing guidance can be exported as a Markdown file.

### Graph visualisation

Both graphs are force-directed using D3.

**Extracted Graph** — nodes are sized by `mentionCount`: more frequently mentioned concepts render larger. Colours indicate integration state:

| Colour | Integration state |
|---|---|
| Gold | `well_integrated` |
| Amber | `weakly_integrated` |
| Red | `underexplained` |
| Pink | `naming_inconsistent` |
| Grey | Disconnected from the anchor via explicit relationships |

Hovering a node surfaces a tooltip showing its explanatory role, integration state, mention frequency, naming variants (if inconsistent), and SVO relationship triples.

**Proposed Graph** — nodes are sized by `priority` (`essential` renders largest, `useful` smallest). Colours indicate basis:

| Colour | Basis |
|---|---|
| Gold | `observed_in_text` — already in your content |
| Purple | `strong_topic_inference` — needed, missing |
| Slate | `optional_enrichment` — adds depth, not required |

Hovering a node surfaces a tooltip showing its explanatory role, whether it is already present in the content, SVO relationship triples, and a summary of the most relevant writing guidance for that concept.

In both graphs, solid edges indicate explicit relationships and dashed edges indicate implied ones.

---

## Self-hosting

```bash
npm run build
npm start
```

Or deploy to Vercel:

```bash
vercel
```

No environment variables are required. The API key is provided by the user in the UI and passed through the server route to Anthropic on each request.

---

## Stack

- [Next.js](https://nextjs.org/) 16 — App Router, streaming API routes
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) — `claude-sonnet-4-20250514`
- [D3](https://d3js.org/) — force-directed graph visualisation
- [node-html-parser](https://github.com/taoqf/node-html-parser) — HTML extraction
- [Zod](https://zod.dev/) — LLM output validation
- [Tailwind CSS](https://tailwindcss.com/) v4

---

## License

[AGPL-3.0](LICENSE.md) — if you modify and distribute this software, or run a modified version on a network server, you must make your source available under the same license.

Built by [Daniel Cheung](https://danielkcheung.com).
