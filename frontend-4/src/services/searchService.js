import { LAB_STATUSES } from '../data/mockReports.js'
import { formatDate, getDocumentTypeLabel } from '../utils/documents.js'

const MAX_PER_GROUP = 5

export function searchHealthData(rawQuery, { documents, reports, medicines, pages }) {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return []

  const matches = (...fields) => fields.some((field) => field && String(field).toLowerCase().includes(query))

  const groups = [
    {
      id: 'records',
      label: 'Records',
      items: documents
        .filter((doc) => matches(doc.title, doc.description, doc.provider, getDocumentTypeLabel(doc.type)))
        .slice(0, MAX_PER_GROUP)
        .map((doc) => ({
          id: `record-${doc.id}`,
          kind: 'record',
          label: doc.title,
          description: `${getDocumentTypeLabel(doc.type)} · ${formatDate(doc.date)}`,
          to: `/records/${doc.id}`,
        })),
    },
    {
      id: 'lab-values',
      label: 'Lab values',
      items: reports
        .flatMap((report) =>
          report.labValues
            .filter((value) => matches(value.name, LAB_STATUSES[value.status]?.label))
            .map((value) => ({
              id: `lab-${report.id}-${value.id}`,
              kind: 'lab',
              label: value.name,
              description: `${value.value} ${value.unit} · ${LAB_STATUSES[value.status]?.label}`,
              to: '/reports',
            })),
        )
        .slice(0, MAX_PER_GROUP),
    },
    {
      id: 'medicines',
      label: 'Medicines',
      items: medicines
        .filter((medicine) => matches(medicine.name, medicine.purpose, medicine.strength, medicine.notes))
        .slice(0, MAX_PER_GROUP)
        .map((medicine) => ({
          id: `medicine-${medicine.id || medicine._id}`,
          kind: 'medicine',
          label: medicine.name,
          description: medicine.strength || medicine.purpose || medicine.frequency || 'Prescribed medicine',
          to: '/medicines',
        })),
    },
    {
      id: 'pages',
      label: 'Pages',
      items: pages
        .filter((page) => matches(page.label))
        .map((page) => ({
          id: `page-${page.id}`,
          kind: 'page',
          label: page.label,
          description: 'Go to page',
          to: page.to,
        })),
    },
  ]

  return groups.filter((group) => group.items.length > 0)
}
