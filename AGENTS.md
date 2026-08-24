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
