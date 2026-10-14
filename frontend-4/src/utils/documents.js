import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from '../data/mockDocuments.js'

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function formatDate(isoDate) {
  if (!isoDate) return '—'
  const date = new Date(`${isoDate}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

export function getDocumentTypeLabel(type) {
  return DOCUMENT_TYPES[type]?.label ?? 'Other'
}

export function getDocumentCategory(type) {
  return DOCUMENT_TYPES[type]?.category ?? 'scan'
}

export function getStatusLabel(status) {
  return DOCUMENT_STATUSES[status]?.label ?? 'Unknown'
}

export function sortByDateDesc(documents) {
  return [...documents].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/**
 * Counts are measured against the month of the most recent record, so the demo
 * trends stay stable regardless of the visitor's clock.
 */
export function getDocumentStats(documents) {
  const latestDate = documents.reduce((latest, doc) => (doc.date > latest ? doc.date : latest), '')
  const currentPeriod = latestDate.slice(0, 7)

  const summarize = (predicate) => {
    const items = documents.filter(predicate)
    return {
      count: items.length,
      addedThisPeriod: currentPeriod ? items.filter((doc) => doc.date.startsWith(currentPeriod)).length : 0,
    }
  }

  return {
    total: summarize(() => true),
    lab: summarize((doc) => getDocumentCategory(doc.type) === 'lab'),
    prescription: summarize((doc) => getDocumentCategory(doc.type) === 'prescription'),
    scan: summarize((doc) => getDocumentCategory(doc.type) === 'scan'),
  }
}

export function isValidDocumentList(value) {
  return (
    Array.isArray(value) &&
    value.every((doc) => doc && typeof doc.id === 'string' && typeof doc.title === 'string' && typeof doc.date === 'string')
  )
}
