import { splitVariables } from '../lib/environments'

interface VariableTextProps {
  value: string
  textClassName?: string
}

export default function VariableText({ value, textClassName = 'text-studio-text' }: VariableTextProps) {
  const segments = splitVariables(value)
  return (
    <>
      {segments.map((segment, index) =>
        segment.variable ? (
          <span key={index} className="rounded bg-studio-accent/25 text-sky-300">
            {segment.text}
          </span>
        ) : (
          <span key={index} className={textClassName}>
            {segment.text}
          </span>
        )
      )}
    </>
  )
}
