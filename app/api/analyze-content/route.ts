import { NextRequest } from 'next/server'
import { extractMainContent } from '@/lib/pipeline/extractMainContent'
import { classifyAndObserve } from '@/lib/pipeline/classifyAndObserve'
import { buildExplanationFramework } from '@/lib/pipeline/buildExplanationFramework'
import { generateWritingGuidance } from '@/lib/pipeline/generateWritingGuidance'
import type { AnalyzeRequest, StreamEvent } from '@/lib/types'

function encode(event: StreamEvent): string {
  return JSON.stringify(event) + '\n'
}

function authError() {
  return new Response(
    encode({ stage: 'error', data: { message: 'Missing API key. Provide an Anthropic API key via Authorization header.' } }),
    { status: 401, headers: { 'Content-Type': 'application/x-ndjson' } },
  )
}

function bodyError(msg: string) {
  return new Response(
    encode({ stage: 'error', data: { message: msg } }),
    { status: 400, headers: { 'Content-Type': 'application/x-ndjson' } },
  )
}

const STREAM_HEADERS = {
  'Content-Type': 'application/x-ndjson',
  'Cache-Control': 'no-cache',
  'X-Accel-Buffering': 'no',
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!apiKey) return authError()

  let body: AnalyzeRequest
  try {
    body = await req.json()
  } catch {
    return bodyError('Invalid JSON body.')
  }

  // ─── Phase 1: extract + classify + observe ────────────────────────────────

  if (body.phase === 1) {
    if (!body.content?.trim()) return bodyError('Content is empty.')

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: StreamEvent) =>
          controller.enqueue(new TextEncoder().encode(encode(event)))

        try {
          const extracted = extractMainContent(body.content, body.inputType)
          send({ stage: 'extracted_content', data: extracted })

          const phase1 = await classifyAndObserve(extracted, apiKey)
          send({ stage: 'observed_analysis', data: { context: phase1.context, observedMap: phase1.observedMap, questionCoverage: phase1.questionCoverage } })
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          const isAuth = message.includes('401') || message.includes('403') || message.toLowerCase().includes('authentication')
          send({ stage: 'error', data: { message: isAuth ? 'Invalid API key.' : `Analysis failed: ${message}` } })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, { headers: STREAM_HEADERS })
  }

  // ─── Phase 2: framework + writing guidance ────────────────────────────────

  if (body.phase === 2) {
    const { context, observedMap, questionCoverage } = body

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: StreamEvent) =>
          controller.enqueue(new TextEncoder().encode(encode(event)))

        try {
          const framework = await buildExplanationFramework(context, observedMap, apiKey)
          send({ stage: 'explanation_framework', data: framework })

          const guidance = await generateWritingGuidance(context, framework, questionCoverage, apiKey)
          send({ stage: 'writing_guidance', data: guidance })
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          const isAuth = message.includes('401') || message.includes('403') || message.toLowerCase().includes('authentication')
          send({ stage: 'error', data: { message: isAuth ? 'Invalid API key.' : `Analysis failed: ${message}` } })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, { headers: STREAM_HEADERS })
  }

  return bodyError('Invalid phase.')
}
