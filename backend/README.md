# HealthSaathi AI — Backend

Node.js + TypeScript REST API for the HealthSaathi personal health-record platform.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript 5 |
| Framework | Express 4 with express-async-errors |
| Database | MongoDB 6 (Atlas) |
| Auth | Firebase Admin SDK (ID-token verification) |
| File Storage | Firebase Storage (signed URLs) |
| AI | Groq API (llama-3.3-70b-versatile) |
| Validation | Zod |
| Rate limiting | express-rate-limit |

## Project Structure

```
src/
├── config/         # env, mongo, firebase
├── middleware/     # auth (Firebase token), error handler
├── routes/         # one file per resource group
│   ├── health.ts        GET /health/live, /health/ready
│   ├── users.ts         GET/PATCH /me, DELETE /me
│   ├── documents.ts     POST /documents/uploads, GET/DELETE /documents, download, findings, reprocess
│   ├── medicines.ts     CRUD /medicines
│   ├── appointments.ts  CRUD /appointments
│   ├── reminders.ts     CRUD /reminders + /complete
│   ├── dashboard.ts     GET /dashboard, /reports, /timeline
│   └── copilot.ts       CRUD /copilot/conversations + /messages
├── services/
│   └── groqAdapter.ts   Groq client, emergency guardrails, system prompt
├── types/
│   ├── models.ts    MongoDB document types
│   └── express.ts   Express module augmentation (req.auth, req.requestId)
├── utils/
│   ├── audit.ts, errors.ts, pagination.ts, response.ts
├── workers/
│   └── documentWorker.ts  Background job processor (polls every 5s)
├── app.ts          Express app factory
└── server.ts       Entrypoint
```

## Quick Start

### 1. Prerequisites

- Node.js ≥ 20
- Python ≥ 3.10
- Native Tesseract OCR executable:
  - **macOS:** `brew install tesseract`
  - **Ubuntu/Debian:** `sudo apt-get update && sudo apt-get install -y tesseract-ocr tesseract-ocr-eng`
- MongoDB Atlas cluster (URI in `.env`)
- Firebase project (for auth and storage)
- Groq API key (for AI copilot and summarization)

### 2. Python OCR Module Setup

The document processor uses a modular Python component powered by **PyMuPDF**, **Pillow**, and **Tesseract OCR**:

```bash
cd ocr
# Create virtual environment
python3 -m venv .venv

# Install dependencies (PyMuPDF, Pillow, pytesseract, pytest)
.venv/bin/pip install -r requirements.txt

# Run Python OCR unit test suite
.venv/bin/pytest tests/test_ocr.py -v
cd ..
```

### 3. Configure environment

Copy `.env` and fill in missing values:

```bash
cp .env .env.local
```

Ensure OCR environment variables are set:
```bash
PYTHON_PATH=ocr/.venv/bin/python
TESSERACT_LANG=eng
OCR_MAX_PAGES=50
OCR_TIMEOUT_MS=60000
# Optional: TESSERACT_CMD=/usr/bin/tesseract (only if not on system PATH)
```

**Required for Firebase auth to verify tokens:**
Download the service account JSON from Firebase Console → Project Settings → Service Accounts → Generate new private key, then set:

```
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
```

### 4. Run & Test

```bash
# Install backend dependencies
npm install

# Run all test suites (Python OCR + Node.js integration tests)
npm run test:all

# Development API server (hot-reload)
npm run dev

# Background document intelligence worker (separate terminal)
npm run worker

# Production build
npm run build
npm start
```

## API Reference

**Base URL:** `http://localhost:3001/api/v1`
**Auth:** `Authorization: Bearer <Firebase ID Token>`

### Health
| Endpoint | Description |
|---|---|
| `GET /health/live` | Always returns 200 |
| `GET /health/ready` | Returns 200 if MongoDB is reachable |

### User Profile
| Endpoint | Description |
|---|---|
| `GET /me` | Get or create profile |
| `PATCH /me` | Update allow-listed fields |
| `POST /me/reset-preferences` | Reset UI preferences |
| `DELETE /me` | Initiate account deletion |

### Documents
| Endpoint | Description |
|---|---|
| `POST /documents/uploads` | Upload a document (multipart/form-data, field: `file`) |
| `GET /documents` | List with filters: `type`, `status`, `dateFrom`, `dateTo`, `cursor`, `limit` |
| `GET /documents/:id` | Get document + finding count |
| `GET /documents/:id/download` | Get 15-min signed download URL |
| `DELETE /documents/:id` | Soft-delete + enqueue purge |
| `GET /documents/:id/findings` | List normalized findings |
| `POST /documents/:id/reprocess` | Retry failed processing |

**Document status flow:** `UPLOADING → QUEUED → PROCESSING → READY | READY_WITH_WARNINGS | FAILED`

### Health Data
| Endpoint | Description |
|---|---|
| `GET/POST /medicines` | List / create medicines |
| `GET/PATCH/DELETE /medicines/:id` | Get / update / delete |
| `GET/POST /appointments` | List / create |
| `GET/PATCH/DELETE /appointments/:id` | CRUD |
| `GET/POST /reminders` | List / create |
| `GET/PATCH/DELETE /reminders/:id` | CRUD |
| `POST /reminders/:id/complete` | Mark complete |

### Dashboard & Timeline
| Endpoint | Description |
|---|---|
| `GET /dashboard` | Aggregated counts, recent docs, upcoming appointments |
| `GET /reports` | Normalized findings across documents |
| `GET /records` | Compatibility alias for document list |
| `GET /timeline` | Merged document + appointment events by date |

### Copilot
| Endpoint | Description |
|---|---|
| `POST /copilot/conversations` | Start conversation |
| `GET /copilot/conversations` | List conversations |
| `GET /copilot/conversations/:id/messages` | Get messages |
| `POST /copilot/conversations/:id/messages` | Send message (calls Groq, with emergency guardrail) |
| `DELETE /copilot/conversations/:id` | Soft-delete |

## Safety Guardrails

- **Emergency detection:** Any message matching patterns like "chest pain", "can't breathe", "suicide", etc. returns a fixed emergency-services message **without calling Groq**.
- **Prompt injection protection:** Document content is wrapped in delimiters and cannot override system instructions.
- **API key never exposed:** Groq key is server-only; clients never see it.
- **Owner isolation:** Every DB query includes `ownerId: req.auth.uid` as a predicate (not a post-filter).
- **Daily quota:** 50 copilot messages/user/day (configurable).

## Security Notes

- Firebase service-account JSON must never be committed.
- Rotate `GROQ_API_KEY` regularly.
- In production, set `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` from a secrets manager.
- Run `npm audit fix` before deploying.
