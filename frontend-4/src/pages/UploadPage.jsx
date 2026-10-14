import { useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CircleAlert, FileUp, Info, X } from 'lucide-react'
import { Button } from '../components/common/Button.jsx'
import { PageHeader } from '../components/common/PageHeader.jsx'
import { useHealthData } from '../context/HealthDataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { DOCUMENT_TYPES } from '../data/mockDocuments.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { cn } from '../utils/cn.js'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
const todayIso = () => new Date().toISOString().slice(0, 10)

function validate(values, file) {
  const errors = {}
  if (!file) errors.file = 'Choose a PDF, PNG or JPG file to upload.'
  else if (!ACCEPTED_TYPES.includes(file.type)) errors.file = 'Only PDF, PNG and JPG files are supported.'
  else if (file.size > MAX_FILE_BYTES) errors.file = 'File must be 10 MB or smaller.'
  if (!values.title.trim()) errors.title = 'Give this document a name.'
  else if (values.title.trim().length > 80) errors.title = 'Keep the name under 80 characters.'
  if (!values.date) errors.date = 'Select the report date.'
  else if (values.date > todayIso()) errors.date = 'The report date cannot be in the future.'
  return errors
}

export default function UploadPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('upload.title', 'Upload Documents'))
  const navigate = useNavigate()
  const { addDocument, registerLocalFile } = useHealthData()
  const { notify } = useToast()
  const inputRef = useRef(null)
  const ids = { file: useId(), title: useId(), type: useId(), date: useId(), description: useId(), provider: useId() }

  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [values, setValues] = useState({ title: '', type: 'lab', date: todayIso(), description: '', provider: '' })

  const updateValue = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }))

  const selectFile = (nextFile) => {
    if (!nextFile) return
    setFile(nextFile)
    setErrors((current) => ({ ...current, file: undefined }))
    if (!values.title) {
      setValues((current) => ({ ...current, title: nextFile.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') }))
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validate(values, file)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    try {
      setIsSubmitting(true)
      const document = await addDocument({
        title: values.title.trim(),
        type: values.type,
        date: values.date,
        description: values.description.trim() || DOCUMENT_TYPES[values.type].label,
        provider: values.provider.trim(),
        fileName: file.name,
        file,
      })
      if (document?.id) {
        registerLocalFile(document.id, file)
        notify({ title: 'Document added', description: 'Document saved and file preview is ready.' })
        navigate(`/records/${document.id}`)
      }
    } catch (err) {
      notify({ title: 'Upload failed', description: err.message || 'Could not process upload.', tone: 'danger' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t('upload.eyebrow', 'Upload Documents')}
        title={t('upload.title', 'Add a medical document')}
        description={t('upload.description', 'Upload a lab report, prescription or scan for automated processing and Copilot analysis.')}
      />

      <form noValidate onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby={ids.file} className="panel flex flex-col p-5 sm:p-6">
          <h2 id={ids.file} className="text-lg font-bold text-navy-900">
            File
          </h2>
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragging(false)
              selectFile(event.dataTransfer.files?.[0])
            }}
            className={cn(
              'mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
              isDragging ? 'border-brand-500 bg-brand-50' : 'border-ice-200 bg-ice-50/60',
              errors.file && 'border-rose-300 bg-rose-50/40',
            )}
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-card">
              <FileUp className="size-6" aria-hidden="true" />
            </span>
            {file ? (
              <div className="mt-4 flex max-w-full items-center gap-2 rounded-full bg-white py-1.5 pr-1.5 pl-4 shadow-card">
                <span className="truncate text-sm font-semibold text-navy-900">{file.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    if (inputRef.current) inputRef.current.value = ''
                  }}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-ice-100"
                >
                  <X className="size-4" aria-hidden="true" />
                  <span className="sr-only">Remove selected file</span>
                </button>
              </div>
            ) : (
              <p className="mt-4 text-[15px] font-semibold text-navy-900">{t('upload.drag_drop', 'Drag and drop your file here')}</p>
            )}
            <p className="mt-1 text-sm text-muted">{t('upload.supported_formats', 'PDF, PNG or JPG · up to 10 MB')}</p>
            <Button variant="secondary" className="mt-5" onClick={() => inputRef.current?.click()}>
              {t('upload.browse_btn', 'Browse files')}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="sr-only"
              aria-label="Choose document file"
              aria-describedby={errors.file ? `${ids.file}-error` : undefined}
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
          </div>
          <FieldError id={`${ids.file}-error`} message={errors.file} />
        </section>

        <section aria-label="Document details" className="panel flex flex-col gap-4 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-navy-900">Details</h2>
          <Field id={ids.title} label="Document name" error={errors.title}>
            <input
              id={ids.title}
              value={values.title}
              onChange={updateValue('title')}
              placeholder="e.g. Blood Test Report"
              className="field"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? `${ids.title}-error` : undefined}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={ids.type} label="Type">
              <select id={ids.type} value={values.type} onChange={updateValue('type')} className="field">
                {Object.entries(DOCUMENT_TYPES).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={ids.date} label="Report date" error={errors.date}>
              <input
                id={ids.date}
                type="date"
                max={todayIso()}
                value={values.date}
                onChange={updateValue('date')}
                className="field"
                aria-invalid={Boolean(errors.date)}
                aria-describedby={errors.date ? `${ids.date}-error` : undefined}
              />
            </Field>
          </div>
          <Field id={ids.description} label="Short description" optional>
            <input
              id={ids.description}
              value={values.description}
              onChange={updateValue('description')}
              placeholder="e.g. Routine health checkup"
              className="field"
            />
          </Field>
          <Field id={ids.provider} label="Doctor or lab" optional>
            <input
              id={ids.provider}
              value={values.provider}
              onChange={updateValue('provider')}
              placeholder="e.g. Apollo Diagnostics"
              className="field"
            />
          </Field>

          <p className="flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-xs text-brand-700">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Demo mode: metadata is stored in this browser. The original file is previewed only during this session; OCR and AI analysis are not connected yet.
          </p>

          <div className="mt-auto flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button to="/records" variant="secondary" className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? 'Saving…' : 'Save Document'}
            </Button>
          </div>
        </section>
      </form>
    </div>
  )
}

function Field({ id, label, optional, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-navy-900">
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

function FieldError({ id, message }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-600">
      <CircleAlert className="size-3.5" aria-hidden="true" />
      {message}
    </p>
  )
}
