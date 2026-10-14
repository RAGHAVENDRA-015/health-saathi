# HealthSaathi AI — Frontend Prototype

A frontend-only personal health copilot prototype built with React, Vite, Tailwind CSS v4, React Router DOM, and Lucide React. It uses fictional sample health data and browser-local persistence. There is no backend, OCR, or real LLM integration in this release.

## Getting started

Requirements: Node.js compatible with the installed Vite version and npm or pnpm.

```bash
npm install
npm run dev
```

The development server is configured to run at `http://localhost:3000`. To verify the production bundle, run:

```bash
npm run build
npm run preview
```

## Routes

### Public pages
- `/` — Landing page
- `/login` — Demo login
- `/register` — Demo profile registration
- `/forgot-password` — Non-sending recovery-flow preview

### Application pages
- `/dashboard` — Dashboard
- `/upload` — Document metadata upload flow (selected file can be previewed during the current session; bytes are not persisted and no analysis is performed)
- `/records` — Searchable demo records
- `/records/:documentId` — Document metadata and sample analysis
- `/reports` — Sample lab reports and insights
- `/copilot` — Interactive demo chat with prewritten responses and source-record links
- `/timeline` — Chronological view of document, appointment and medicine events
- `/medicines` — Local medicine-list CRUD, search, status tabs and archive action
- `/appointments` — Local appointment CRUD, upcoming/past filters, completion and cancellation actions
- `/reminders` — Local reminder CRUD, filters, enabled/paused and completed state
- `/profile` — Editable personal details, optional health notes, preferences, privacy guidance and demo reset

## Changes in this update

- Added an editorial landing page using the existing navy, icy-blue, cyan, and lime visual system and local medical images.
- Added demo-only login, registration, and forgot-password pages with client-side validation and clear demo disclaimers.
- Implemented an interactive Copilot demo chat with suggested prompts, short simulated responses, and source-record links.
- Added session-only uploaded file previews for PDFs and images on Document Analysis; extracted text and AI analysis remain unavailable.
- Corrected route ownership so `/` is the landing page and `/dashboard` is the dashboard.
- Updated dashboard navigation and placeholder “Back to Dashboard” actions to use `/dashboard`.
- Persisted a user demo profile in the existing namespaced localStorage store, so a registration name/email carries into the dashboard.
- Implemented Health Timeline using the shared document, appointment and medicine records, with category filters and date sorting.
- Implemented local CRUD for medicines, including status tabs, search, validation, edit, delete and archive/reactivate actions.
- Implemented appointment scheduling UI for demo entries, edit/reschedule, upcoming/past/all filters, mark complete, cancellation and form validation.
- Implemented reminders with category filters, create/edit/delete, enabled/paused and completion states.
- Implemented editable profile, optional health notes, language preferences, local preference toggles, and reset demo data controls.
- Extended shared HealthDataContext with localStorage-persisted medicines, appointments and reminders.
- Kept public routes and the dashboard shared application shell separate.

## Current limits

- Login and registration are not real authentication and do not contact a server. Never enter a real password or sensitive health information.
- The upload page saves document metadata locally and keeps the selected file in memory for a temporary preview during the current browser session; it does not persist the file bytes or perform OCR/analysis.
- Healthcare management pages use localStorage-backed demo data only. They do not book real appointments, send reminders or manage actual prescriptions. Copilot is currently a simulated UI, not a real AI integration.
- All medical values, insights, documents and clinician details are fictional sample data, not medical advice.

## Project structure

```text
src/
  app/         App providers and route configuration
  components/  Shared layout, dashboard and common UI components
  context/     Shared demo health data and toast state
  data/        Fictional demo data
  hooks/       Persistence, hotkey, click-outside and title hooks
  pages/       Public pages and application feature pages
  services/    Local storage and search helpers
  utils/       Formatting and class-name helpers
public/images/ Local healthcare illustrations
```

## Deployment

`vercel.json` configures SPA route rewrites so direct navigation and refreshes on client-side routes return `index.html`.

## Phase 4 — Lab Reports & Results

The Reports screen (`/reports`) now includes:

- A consolidated results table with search, category filters (blood, urine, imaging and other), date/name/status sorting, and result detail dialogs.
- Demo status derivation from explicit numeric reference ranges where supported. Values with non-numeric results or unsupported ranges keep their authored status rather than receiving a guessed classification.
- An accessible SVG trend chart that only plots repeated numeric test values with the same test name and unit.
- CSV export for the currently filtered result rows.
- Source-record links and links into the demo Copilot.
- Additional fictional report data for lipid, thyroid, liver, kidney, urinalysis, CT and X-ray screen flows.
- A one-time Phase 4 migration to connect older localStorage records to report IDs and seed the urinalysis demo document without replacing user edits.

All medical values and observations remain fictional UI data. The screen does not perform OCR, diagnose conditions, or provide medical advice.
