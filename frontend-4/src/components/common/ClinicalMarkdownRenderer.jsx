import { cn } from '../../utils/cn.js'

export function splitTableRow(line) {
  let cleaned = line.trim()
  if (cleaned.startsWith('|')) cleaned = cleaned.slice(1)
  if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1)
  return cleaned.split('|').map((cell) => cell.trim())
}

export function isTableDivider(line) {
  const trimmed = line.trim()
  return (
    /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(trimmed) ||
    (/^\|?[\s\-:|]+$/.test(trimmed) && trimmed.includes('-'))
  )
}

export function parseMarkdownBlocks(text) {
  if (!text) return []
  const rawLines = text.split('\n')
  const blocks = []
  let i = 0

  while (i < rawLines.length) {
    const line = rawLines[i]
    const trimmed = line.trim()

    // 1. Skip empty lines
    if (!trimmed) {
      i++
      continue
    }

    // 2. Code blocks (``` or ~~~)
    if (/^```/.test(trimmed)) {
      const codeLines = []
      i++
      while (i < rawLines.length && !/^```/.test(rawLines[i].trim())) {
        codeLines.push(rawLines[i])
        i++
      }
      if (i < rawLines.length) i++
      blocks.push({ type: 'code', content: codeLines.join('\n') })
      continue
    }

    // 3. Horizontal divider
    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // 4. Headings (#, ##, ###)
    if (/^#{1,6}\s+/.test(trimmed)) {
      const level = trimmed.match(/^(#{1,6})/)[0].length
      const content = trimmed.replace(/^#{1,6}\s+/, '')
      blocks.push({ type: 'heading', level, content })
      i++
      continue
    }

    // 5. Standalone bold section header: **Current medications**
    if (/^\*\*[^*]+\*\*$/.test(trimmed)) {
      const content = trimmed.slice(2, -2).trim()
      blocks.push({ type: 'section-title', content })
      i++
      continue
    }

    // 6. Emergency / Important Callout
    if (/^⚠️/.test(trimmed)) {
      const alertLines = []
      while (i < rawLines.length && rawLines[i].trim()) {
        alertLines.push(rawLines[i])
        i++
      }
      blocks.push({ type: 'emergency-alert', content: alertLines.join('\n') })
      continue
    }

    // 7. Markdown Tables
    const isTableLine = (l) => {
      const t = l.trim()
      return (
        (t.startsWith('|') && (t.endsWith('|') || t.split('|').length >= 3)) ||
        (t.includes('|') && t.split('|').length >= 3)
      )
    }

    if (isTableLine(line)) {
      const tableLines = []
      while (i < rawLines.length && isTableLine(rawLines[i])) {
        tableLines.push(rawLines[i])
        i++
      }

      let headers = null
      let rows = []

      if (tableLines.length >= 2 && isTableDivider(tableLines[1])) {
        headers = splitTableRow(tableLines[0])
        rows = tableLines.slice(2).filter((l) => !isTableDivider(l)).map(splitTableRow)
      } else {
        rows = tableLines.filter((l) => !isTableDivider(l)).map(splitTableRow)
      }

      blocks.push({ type: 'table', headers, rows })
      continue
    }

    // 8. Unordered lists (-, *, •)
    const isUnordered = (l) => /^[-*•]\s+/.test(l.trim())
    if (isUnordered(line)) {
      const items = []
      while (i < rawLines.length && isUnordered(rawLines[i])) {
        items.push(rawLines[i].trim().replace(/^[-*•]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    // 9. Ordered lists (1., 2., etc.)
    const isOrdered = (l) => /^\d+\.\s+/.test(l.trim())
    if (isOrdered(line)) {
      const items = []
      while (i < rawLines.length && isOrdered(rawLines[i])) {
        items.push(rawLines[i].trim().replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    // 10. Regular paragraphs
    const paraLines = []
    while (
      i < rawLines.length &&
      rawLines[i].trim() &&
      !/^```/.test(rawLines[i].trim()) &&
      !/^(---|___|\*\*\*)$/.test(rawLines[i].trim()) &&
      !/^#{1,6}\s+/.test(rawLines[i].trim()) &&
      !/^\*\*[^*]+\*\*$/.test(rawLines[i].trim()) &&
      !/^⚠️/.test(rawLines[i].trim()) &&
      !isTableLine(rawLines[i]) &&
      !isUnordered(rawLines[i]) &&
      !isOrdered(rawLines[i])
    ) {
      paraLines.push(rawLines[i])
      i++
    }

    if (paraLines.length > 0) {
      blocks.push({ type: 'p', content: paraLines.join('\n') })
    }
  }

  return blocks
}

export function InlineMarkdown({ text, isCell = false }) {
  if (!text) return null

  if (isCell) {
    const trimmedLower = text.trim().toLowerCase()
    if (
      trimmedLower === 'normal' ||
      trimmedLower === 'within normal limits' ||
      trimmedLower === 'optimal'
    ) {
      return (
        <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
          {text}
        </span>
      )
    }
  }

  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null

        if (part.startsWith('**') && part.endsWith('**')) {
          const inner = part.slice(2, -2)
          const lower = inner.trim().toLowerCase()

          if (lower === 'high' || lower.startsWith('high') || lower === 'elevated') {
            return (
              <span
                key={index}
                className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700"
              >
                {inner}
              </span>
            )
          }

          if (lower === 'low' || lower.startsWith('low') || lower === 'deficient') {
            return (
              <span
                key={index}
                className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700"
              >
                {inner}
              </span>
            )
          }

          if (lower === 'normal' || lower === 'optimal' || lower.startsWith('normal')) {
            return (
              <span
                key={index}
                className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700"
              >
                {inner}
              </span>
            )
          }

          return (
            <strong key={index} className="font-bold text-navy-950">
              {inner}
            </strong>
          )
        }

        if (part.startsWith('*') && part.endsWith('*')) {
          const inner = part.slice(1, -1)
          return (
            <em key={index} className="italic text-navy-800">
              {inner}
            </em>
          )
        }

        if (part.startsWith('`') && part.endsWith('`')) {
          const inner = part.slice(1, -1)
          return (
            <code
              key={index}
              className="rounded bg-ice-100 px-1.5 py-0.5 font-mono text-[11px] text-brand-800"
            >
              {inner}
            </code>
          )
        }

        return part.includes('\n') ? (
          part.split('\n').map((line, lIdx, arr) => (
            <span key={`${index}-${lIdx}`}>
              {line}
              {lIdx < arr.length - 1 && <br />}
            </span>
          ))
        ) : (
          <span key={index}>{part}</span>
        )
      })}
    </>
  )
}

export function ClinicalMarkdownRenderer({ content }) {
  if (!content) return null
  const blocks = parseMarkdownBlocks(content)

  return (
    <div className="space-y-3 text-xs sm:text-sm leading-relaxed text-navy-900">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'hr':
            return <hr key={index} className="my-4 border-t border-ice-200" />

          case 'heading': {
            const HeadingTag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4'
            return (
              <HeadingTag
                key={index}
                className="mt-4 mb-2 flex items-center gap-2 text-sm sm:text-base font-extrabold tracking-tight text-navy-950"
              >
                <InlineMarkdown text={block.content} />
              </HeadingTag>
            )
          }

          case 'section-title':
            return (
              <div
                key={index}
                className="mt-4 mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-700"
              >
                <span className="size-1.5 rounded-full bg-brand-500" />
                <span>{block.content}</span>
              </div>
            )

          case 'emergency-alert':
            return (
              <div
                key={index}
                className="my-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs leading-6 text-rose-950 shadow-xs"
              >
                <InlineMarkdown text={block.content} />
              </div>
            )

          case 'code':
            return (
              <pre
                key={index}
                className="my-3 overflow-x-auto rounded-xl border border-ice-200 bg-navy-950 p-3.5 font-mono text-xs leading-5 text-ice-100 shadow-inner"
              >
                <code>{block.content}</code>
              </pre>
            )

          case 'table':
            return (
              <div
                key={index}
                className="my-3.5 max-w-full overflow-x-auto rounded-2xl border border-ice-200 bg-white shadow-xs"
              >
                <table className="w-full min-w-[500px] border-collapse text-left text-xs">
                  {block.headers && (
                    <thead>
                      <tr className="border-b border-ice-200 bg-ice-50/90">
                        {block.headers.map((h, hIdx) => (
                          <th
                            key={hIdx}
                            className="px-3.5 py-2.5 font-bold tracking-tight text-navy-900"
                          >
                            <InlineMarkdown text={h} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody className="divide-y divide-ice-100">
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={cn(
                          'transition-colors hover:bg-brand-50/30',
                          rIdx % 2 === 1 ? 'bg-ice-50/25' : 'bg-white'
                        )}
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="px-3.5 py-2.5 align-top leading-5 text-navy-850"
                          >
                            <InlineMarkdown text={cell} isCell />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )

          case 'ul':
            return (
              <ul key={index} className="my-2 space-y-2">
                {block.items.map((item, itemIdx) => (
                  <li
                    key={itemIdx}
                    className="flex items-start gap-2.5 text-xs sm:text-sm leading-6 text-navy-850"
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span className="flex-1">
                      <InlineMarkdown text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            )

          case 'ol':
            return (
              <ol key={index} className="my-2 space-y-2">
                {block.items.map((item, itemIdx) => (
                  <li
                    key={itemIdx}
                    className="flex items-start gap-2.5 text-xs sm:text-sm leading-6 text-navy-850"
                  >
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                      {itemIdx + 1}
                    </span>
                    <span className="flex-1">
                      <InlineMarkdown text={item} />
                    </span>
                  </li>
                ))}
              </ol>
            )

          case 'p':
          default:
            return (
              <p key={index} className="text-xs sm:text-sm leading-6 text-navy-850">
                <InlineMarkdown text={block.content} />
              </p>
            )
        }
      })}
    </div>
  )
}
export default ClinicalMarkdownRenderer
