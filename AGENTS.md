# Codex project instructions

Read the repository documentation before project work.

<!-- BEGIN:glm-52-openrouter-standard -->
## GLM 5.2 through OpenRouter

When the user asks Codex to consult or call GLM 5.2, use the exact model ID
`z-ai/glm-5.2`. That request authorizes the paid call; do not ask again unless
the requested spend or scope materially expands. Locally, load only
`OPENROUTER_API_KEY` from the shared environment file in memory. In Codex
Cloud, use the environment secret named `OPENROUTER_API_KEY`. Never print,
copy, or commit the value.

Never omit reasoning configuration. GLM 5.2 defaults to high reasoning, which
can consume the whole completion budget before final content is produced.

- Use `reasoning: {"effort":"none","exclude":true}` for bounded edits,
  extraction, classification, rewriting, strict JSON, fact checks against
  supplied evidence, quick tool decisions, and long-context audits with an
  explicit rubric.
- Use `reasoning: {"effort":"high","exclude":true}` only for genuinely hard
  planning, competing-hypothesis debugging, or multi-constraint synthesis.
  Keep the input focused and give the model a task-tested completion budget.
  For reasoning that must actually execute, pin a currently verified reasoning
  provider and disable fallbacks; Fireworks is the tested reference provider.
- Use `xhigh` only when explicitly requested or when a measured hard-task eval
  shows high is insufficient. It is not a default.

Every request must include
`provider: {"require_parameters":true,"only":["fireworks"],"allow_fallbacks":false}`.
Fireworks is the current task-tested provider. If it is unavailable, fail
explicitly and revalidate another provider; do not silently fall back to a
provider that only claims parameter support. Use temperature zero for
extraction, grading, and rubric-led review. For machine-readable
answers, use a strict `json_schema` response format instead of relying on prose
instructions alone. Put arbitrary source material in a JSON string/object; do
not wrap HTML source in XML-like delimiters.

Use a compact contract-first prompt: state the task, JSON-escaped inputs,
constraints, exact output contract, and acceptance checks. The system message
should say to return only the final deliverable, omit analysis/reasoning, and
follow the supplied schema exactly.

Treat HTTP 200 as transport success only. Accept the result only when
`message.content` is non-empty, `finish_reason` is not `length`, and the output
passes the declared schema or validator. Never substitute `message.reasoning`
for final content. If validation fails, repair the configuration and retry in
the same Codex turn; do not repeat an identical request or spend a user turn
merely reporting invalid model output.
<!-- END:glm-52-openrouter-standard -->


<!-- BEGIN:deepseek-sonar-openrouter-standard -->
## DeepSeek V4 Pro through OpenRouter

When the user asks Codex to call or consult `DeepSeek` without naming a
different DeepSeek model, use `deepseek/deepseek-v4-pro`. The request
authorizes the paid call; do not ask again unless the requested spend or scope
materially expands. Use the same scoped `OPENROUTER_API_KEY` handling and
secret protections defined above.

Never omit reasoning. DeepSeek V4 Pro defaults to high thinking.

- Use `reasoning: {"effort":"none","exclude":true}` for bounded
  transformations, extraction, classification, strict JSON, fact checks
  against supplied evidence, and deterministic edit decisions.
- Use `reasoning: {"effort":"high","exclude":true}` only for genuinely hard
  planning, competing-hypothesis debugging, or multi-constraint synthesis.
  Keep evidence focused and use a task-tested completion allowance.
- Use `xhigh` only when explicitly requested or when a representative eval
  proves high insufficient.

Every request must include
`provider: {"require_parameters":true,"only":["streamlake"],"allow_fallbacks":false}`.
StreamLake is the current task-tested provider. If unavailable, fail explicitly
and qualify another provider against the same semantic contract before changing
the pin.

Use strict JSON Schema plus semantic validators for machine-readable output.
For exact source, code, or markup edits, ask DeepSeek for a validated selection,
patch, or edit operation and apply it deterministically outside the model. Do
not ask it to regenerate an entire source string when exact preservation
matters.

Treat HTTP 200 as transport success only. Reject a top-level error, empty
`message.content`, `finish_reason: "length"`, schema failure, semantic
failure, or source-preservation failure. Never substitute reasoning for final
content. Repair and retry in the same Codex turn.

## Sonar Deep Research through OpenRouter

Use `perplexity/sonar-deep-research`. A request to use Sonar Deep Research
authorizes the paid call; do not ask again unless spend or scope materially
expands. Treat Sonar as a discovery and evidence-gathering stage, not as an
unvalidated final-answer formatter.

Set reasoning explicitly:

- Use `reasoning: {"effort":"medium","exclude":true}` by default.
- Use `low` only for narrowly scoped research where latency or cost matters.
- Use `high` for exhaustive or high-stakes research.
- Do not disable reasoning; retrieval and reasoning are this model's purpose.

Pin its sole provider with
`provider: {"require_parameters":true,"only":["perplexity"],"allow_fallbacks":false}`.
Do not send `tools` or `response_format` through OpenRouter for this model.
Omit `max_tokens` unless a representative task eval establishes a safe cap,
and allow a ten-minute client timeout.

Use a research-contract prompt: state the downstream decision, precise
questions, as-of date, geography or jurisdiction, source hierarchy, exclusions,
required uncertainty treatment, and citation requirements. Do not rely on
prompted length or domain limits as enforcement.

Accept the transport result only when there is no top-level error,
`message.content` is non-empty, `finish_reason` is not `length`, and
OpenRouter `message.annotations[].url_citation` entries are present and
parseable. Verify every material claim against its cited source. Then require
two independent validators from different providers before treating claims as
fact; flag claims that do not pass.

Retry transient provider errors with bounded backoff in the same Codex turn.
Do not spend a user turn merely reporting a retryable upstream failure.
<!-- END:deepseek-sonar-openrouter-standard -->
