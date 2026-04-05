import { parse, HTMLElement } from 'node-html-parser'
import type { ExtractedContent, ExtractionDiagnostics } from '../types'

// Tags to strip entirely before extraction
const STRIP_TAGS = ['nav', 'header', 'footer', 'script', 'style', 'aside', 'form',
  'noscript', 'template', 'iframe', 'figure', 'figcaption']

// Tags that hold structured data — not content
const STRUCTURED_DATA_ATTRS = ['type="application/ld+json"', 'type="application/json"']

function stripNoise(root: HTMLElement): void {
  STRIP_TAGS.forEach(tag => {
    root.querySelectorAll(tag).forEach(el => el.remove())
  })
  // Remove JSON-LD and other structured data
  root.querySelectorAll('script').forEach(el => {
    const type = el.getAttribute('type') ?? ''
    if (STRUCTURED_DATA_ATTRS.some(attr => attr.includes(type))) el.remove()
    else el.remove() // remove all scripts regardless
  })
}

function getText(el: HTMLElement | null): string {
  return el?.text?.trim().replace(/\s+/g, ' ') ?? ''
}

// ─── Sentence splitter ───────────────────────────────────────────────────────
// Simple heuristic: split on ". ", "! ", "? " not preceded by common abbreviations
function splitSentences(text: string): string[] {
  const raw = text
    .replace(/([.!?])\s+([A-Z])/g, '$1\n$2')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 10)

  return raw
}

// ─── Extract text from DOM element ───────────────────────────────────────────

function extractTextFromElement(el: HTMLElement): string {
  const lines: string[] = []

  function walk(node: HTMLElement) {
    const tag = node.tagName?.toLowerCase() ?? ''

    if (['h1', 'h2', 'h3', 'h4'].includes(tag)) {
      const t = getText(node)
      if (t) lines.push(t)
    } else if (tag === 'p' || tag === 'li') {
      const t = getText(node)
      if (t) lines.push(t)
    } else {
      node.childNodes.forEach(child => {
        if (child instanceof HTMLElement) walk(child)
      })
    }
  }

  walk(el)
  return lines.join('\n')
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function extractMainContent(
  content: string,
  inputType: 'text' | 'html',
): ExtractedContent {
  if (inputType === 'text') {
    const sentences = splitSentences(content)
    const diagnostics: ExtractionDiagnostics = {
      inputType: 'text',
      method: 'passthrough',
      sentenceCount: sentences.length,
      characterCount: content.length,
    }
    return { text: content.trim(), sentences, diagnostics }
  }

  const root = parse(content)
  stripNoise(root)

  // Prefer <main> > <article> > all <p> fallback
  let method: ExtractionDiagnostics['method'] = 'main'
  let contentEl = root.querySelector('main')

  if (!contentEl) {
    contentEl = root.querySelector('article')
    method = 'article'
  }

  let text: string
  let warning: string | undefined

  if (contentEl) {
    text = extractTextFromElement(contentEl)
  } else {
    // Fallback: concatenate all paragraphs on page
    method = 'paragraphs'
    warning = 'No <main> or <article> element found. Extracted all paragraphs.'
    const paras = root.querySelectorAll('p')
      .map(p => getText(p))
      .filter(t => t.length > 20)
    text = paras.join('\n')
  }

  if (!text.trim()) {
    warning = 'Extraction yielded no usable text. Check input HTML.'
  }

  const sentences = splitSentences(text)
  const diagnostics: ExtractionDiagnostics = {
    inputType: 'html',
    method,
    sentenceCount: sentences.length,
    characterCount: text.length,
    warning,
  }

  return { text: text.trim(), sentences, diagnostics }
}
