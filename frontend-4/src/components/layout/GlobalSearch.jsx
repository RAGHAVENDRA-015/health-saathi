import { useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Clock, FileText, FlaskConical, Pill, Search, Sparkles, X } from 'lucide-react'
import { useHealthData } from '../../context/HealthDataContext.jsx'
import { mockMedicines } from '../../data/mockReports.js'
import { primaryNavigation } from '../../data/navigation.js'
import { useClickOutside } from '../../hooks/useClickOutside.js'
import { useModifierHotkey } from '../../hooks/useHotkey.js'
import { searchHealthData } from '../../services/searchService.js'
import { cn } from '../../utils/cn.js'

const kindIcons = { record: FileText, lab: FlaskConical, medicine: Pill, page: ArrowUpRight, ask: Sparkles }

export function GlobalSearch({ className }) {
  const { documents, reports, medicines, recentSearches, addRecentSearch } = useHealthData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listboxId = useId()
  const optionIdPrefix = useId()

  useModifierHotkey('k', () => {
    inputRef.current?.focus()
    setIsOpen(true)
  })
  useClickOutside(containerRef, () => setIsOpen(false), isOpen)

  const trimmedQuery = query.trim()
  const groups = useMemo(
    () => searchHealthData(query, { documents, reports, medicines: medicines || [], pages: primaryNavigation }),
    [query, documents, reports, medicines],
  )

  const askItem = trimmedQuery
    ? {
        id: 'ask-copilot',
        kind: 'ask',
        label: `Ask AI Copilot about “${trimmedQuery}”`,
        description: 'Opens the AI Health Copilot',
        to: `/copilot?q=${encodeURIComponent(trimmedQuery)}`,
      }
    : null
  const options = [...groups.flatMap((group) => group.items), ...(askItem ? [askItem] : [])]
  const showRecent = !trimmedQuery && recentSearches.length > 0
  const showPanel = isOpen && (trimmedQuery || showRecent)

  const selectOption = (option) => {
    addRecentSearch(trimmedQuery)
    setIsOpen(false)
    setQuery('')
    inputRef.current?.blur()
    navigate(option.to)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (query) setQuery('')
      else inputRef.current?.blur()
      setIsOpen(false)
      return
    }
    if (!options.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => (index + 1) % options.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + options.length) % options.length)
    } else if (event.key === 'Enter') {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return
      event.preventDefault()
      const option = options[activeIndex]
      if (option) selectOption(option)
    }
  }

  let optionCursor = -1
  const renderOption = (option) => {
    optionCursor += 1
    const index = optionCursor
    const Icon = kindIcons[option.kind] ?? FileText
    const isActive = index === activeIndex
    return (
      <li
        key={option.id}
        id={`${optionIdPrefix}-${index}`}
        role="option"
        aria-selected={isActive}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => selectOption(option)}
        onPointerMove={() => setActiveIndex(index)}
        className={cn(
          'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5',
          isActive ? 'bg-brand-100/70' : 'hover:bg-ice-50',
        )}
      >
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg',
            option.kind === 'ask' ? 'bg-accent-300/60 text-navy-900' : 'bg-ice-100 text-brand-600',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-navy-900">{option.label}</span>
          <span className="block truncate text-xs text-muted">{option.description}</span>
        </span>
      </li>
    )
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="glass flex h-12 items-center gap-3 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-brand-500/40">
        <Search className="size-5 shrink-0 text-navy-800" aria-hidden="true" />
        <label htmlFor={`${listboxId}-input`} className="sr-only">
          Search reports, medicines, symptoms, or ask AI
        </label>
        <input
          id={`${listboxId}-input`}
          ref={inputRef}
          type="search"
          role="combobox"
          autoComplete="off"
          aria-expanded={Boolean(showPanel)}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && trimmedQuery && options.length ? `${optionIdPrefix}-${activeIndex}` : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search reports, medicines, symptoms, or ask AI..."
          className="min-w-0 flex-1 bg-transparent text-sm text-navy-900 placeholder:text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            className="rounded-full p-1 text-muted hover:bg-ice-100 hover:text-navy-900"
          >
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Clear search</span>
          </button>
        )}
      </div>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 max-h-[min(70vh,30rem)] overflow-y-auto rounded-2xl border border-ice-200 bg-white p-2 shadow-pop">
          {trimmedQuery ? (
            <ul id={listboxId} role="listbox" aria-label="Search results" className="flex flex-col gap-1">
              {groups.map((group) => (
                <li key={group.id} role="presentation">
                  <p className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-wider text-muted uppercase">{group.label}</p>
                  <ul role="group" aria-label={group.label} className="flex flex-col gap-0.5">
                    {group.items.map(renderOption)}
                  </ul>
                </li>
              ))}
              {groups.length === 0 && (
                <li role="presentation" className="px-3 pt-3 pb-1 text-sm text-muted">
                  No records match “{trimmedQuery}”.
                </li>
              )}
              {askItem && (
                <li role="presentation" className="mt-1 border-t border-ice-100 pt-1">
                  <ul role="group" aria-label="Ask AI">
                    {renderOption(askItem)}
                  </ul>
                </li>
              )}
            </ul>
          ) : (
            <div id={listboxId}>
              <p className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-wider text-muted uppercase">Recent searches</p>
              <ul className="flex flex-col gap-0.5">
                {recentSearches.map((term) => (
                  <li key={term}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(term)
                        inputRef.current?.focus()
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-navy-900 hover:bg-ice-50"
                    >
                      <Clock className="size-4 text-muted" aria-hidden="true" />
                      {term}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
