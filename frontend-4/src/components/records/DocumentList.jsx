import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EllipsisVertical, Sparkles, Trash2 } from 'lucide-react'
import { useHealthData } from '../../context/HealthDataContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate } from '../../utils/documents.js'
import { cn } from '../../utils/cn.js'
import { StatusBadge, TypeBadge } from '../common/Badge.jsx'
import { ConfirmDialog } from '../common/ConfirmDialog.jsx'
import { DocumentIcon } from '../common/DocumentIcon.jsx'
import { Dropdown, DropdownItem } from '../common/Dropdown.jsx'

export function DocumentList({ documents, caption, compact = false }) {
  const { removeDocument } = useHealthData()
  const { notify } = useToast()
  const [pendingDelete, setPendingDelete] = useState(null)

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-xs font-semibold text-muted">
              <th scope="col" className={cn("rounded-l-xl bg-ice-50 font-semibold", compact ? "px-3 py-2.5" : "px-4 py-3")}>
                Document Name
              </th>
              <th scope="col" className={cn("bg-ice-50 font-semibold", compact ? "px-3 py-2.5" : "px-4 py-3")}>
                Date
              </th>
              <th scope="col" className={cn("bg-ice-50 font-semibold", compact ? "px-3 py-2.5" : "px-4 py-3")}>
                Type
              </th>
              <th scope="col" className={cn("bg-ice-50 font-semibold", compact ? "px-3 py-2.5" : "px-4 py-3")}>
                Status
              </th>
              <th scope="col" className={cn("rounded-r-xl bg-ice-50 font-semibold text-right", compact ? "px-3 py-2.5" : "px-4 py-3")}>
                <span className="sr-only">Actions</span>
                <span aria-hidden="true">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="group">
                <td className={cn("border-b border-ice-100 group-last:border-0", compact ? "px-3 py-2.5" : "px-4 py-3")}>
                  <div className="flex items-center gap-3">
                    <DocumentIcon type={doc.type} />
                    <div className="min-w-0">
                      <Link
                        to={`/records/${doc.id}`}
                        className="block truncate font-semibold text-navy-900 hover:text-brand-600"
                      >
                        {doc.title}
                      </Link>
                      <p className="truncate text-xs text-muted">{doc.description}</p>
                    </div>
                  </div>
                </td>
                <td className={cn("border-b border-ice-100 whitespace-nowrap text-navy-800 group-last:border-0", compact ? "px-3 py-2.5 text-xs sm:text-sm" : "px-4 py-3")}>
                  <time dateTime={doc.date}>{formatDate(doc.date)}</time>
                </td>
                <td className={cn("border-b border-ice-100 group-last:border-0", compact ? "px-3 py-2.5" : "px-4 py-3")}>
                  <TypeBadge type={doc.type} />
                </td>
                <td className={cn("border-b border-ice-100 group-last:border-0", compact ? "px-3 py-2.5" : "px-4 py-3")}>
                  <StatusBadge status={doc.status} />
                </td>
                <td className={cn("border-b border-ice-100 group-last:border-0", compact ? "px-3 py-2.5" : "px-4 py-3")}>
                  <RowActions document={doc} onRequestDelete={setPendingDelete} compact={compact} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden" aria-label={caption}>
        {documents.map((doc) => (
          <li key={doc.id} className="rounded-2xl border border-ice-100 bg-white/80 p-4">
            <div className="flex items-start gap-3">
              <DocumentIcon type={doc.type} />
              <div className="min-w-0 flex-1">
                <Link to={`/records/${doc.id}`} className="block font-semibold text-navy-900">
                  {doc.title}
                </Link>
                <p className="text-xs text-muted">
                  {doc.description} · <time dateTime={doc.date}>{formatDate(doc.date)}</time>
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <TypeBadge type={doc.type} />
                  <StatusBadge status={doc.status} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <RowActions document={doc} onRequestDelete={setPendingDelete} />
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Remove this record?"
        description={pendingDelete ? `“${pendingDelete.title}” will be removed from your records on this device.` : ''}
        confirmLabel="Remove record"
        onConfirm={() => {
          removeDocument(pendingDelete.id)
          notify({ title: 'Record removed', description: pendingDelete.title, tone: 'info' })
        }}
      />
    </>
  )
}

function RowActions({ document, onRequestDelete, compact = false }) {
  return (
    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
      <Link
        to={`/records/${document.id}`}
        className={cn(
          "inline-flex items-center rounded-full border border-ice-200 bg-white font-semibold text-navy-900 shadow-2xs transition-colors hover:border-brand-300 hover:bg-brand-50/50",
          compact ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm"
        )}
      >
        View
        <span className="sr-only"> {document.title}</span>
      </Link>
      <Dropdown
        panelClassName="w-56"
        renderTrigger={({ triggerProps }) => (
          <button
            type="button"
            {...triggerProps}
            className={cn(
              "grid place-items-center rounded-full text-navy-900 transition-colors hover:bg-ice-100",
              compact ? "size-8" : "size-9"
            )}
          >
            <EllipsisVertical className="size-4" aria-hidden="true" />
            <span className="sr-only">More actions for {document.title}</span>
          </button>
        )}
      >
        {({ close }) => (
          <div className="flex flex-col gap-0.5">
            <DropdownItem as={Link} to={`/records/${document.id}`} icon={Eye} onClick={close}>
              View details
            </DropdownItem>
            <DropdownItem
              as={Link}
              to={`/copilot?q=${encodeURIComponent(`Explain my ${document.title}`)}&doc=${encodeURIComponent(document.id || document._id)}`}
              icon={Sparkles}
              onClick={close}
            >
              Ask AI Copilot
            </DropdownItem>
            <DropdownItem
              icon={Trash2}
              tone="danger"
              onClick={() => {
                close()
                onRequestDelete(document)
              }}
            >
              Remove record
            </DropdownItem>
          </div>
        )}
      </Dropdown>
    </div>
  )
}
