import { renderMarkdown } from '@/lib/markdown'

export default function Prose({ source, className = '' }: { source: string; className?: string }) {
  return <div className={`prose ${className}`.trim()} dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />
}
