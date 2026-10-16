import type { ReactNode } from 'react'

const TOKEN_REGEX = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

interface JsonViewProps {
  content: string
  className?: string
}

export default function JsonView({ content, className }: JsonViewProps) {
  let pretty = content
  try {
    pretty = JSON.stringify(JSON.parse(content), null, 2)
  } catch {
    pretty = content
  }

  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  TOKEN_REGEX.lastIndex = 0
  while ((match = TOKEN_REGEX.exec(pretty)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(pretty.slice(lastIndex, match.index))
    }

    const [, str, colon, bool, num] = match
    if (str !== undefined) {
      if (colon !== undefined) {
        nodes.push(
          <span key={key++} className="text-sky-300">
            {str}
          </span>
        )
        nodes.push(
          <span key={key++} className="text-studio-muted">
            {colon}
          </span>
        )
      } else {
        nodes.push(
          <span key={key++} className="text-emerald-300">
            {str}
          </span>
        )
      }
    } else if (bool !== undefined) {
      nodes.push(
        <span key={key++} className="text-violet-300">
          {bool}
        </span>
      )
    } else if (num !== undefined) {
      nodes.push(
        <span key={key++} className="text-amber-300">
          {num}
        </span>
      )
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < pretty.length) nodes.push(pretty.slice(lastIndex))

  return <pre className={className}>{nodes}</pre>
}
