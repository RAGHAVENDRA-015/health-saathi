# HealthSaathi AI (स्वास्थ्य साथी / హెల్త్ సాథి)

### Next-Generation Multilingual Personal Health Copilot & Smart Medical Records Platform

HealthSaathi AI is a patient-centric healthcare platform designed to
help people understand, organize, and manage their health information.
It combines document OCR, multilingual conversational AI, voice input,
medication tracking, appointment management, and reminders to make
health information more accessible in **English, Hindi (हिंदी), and
Telugu (తెలుగు)**.

> **Important:** HealthSaathi AI is an informational support tool, not a
> substitute for a qualified healthcare professional, diagnosis, or
> emergency medical care.

------------------------------------------------------------------------

## Table of Contents

-   [Overview](#overview)
-   [Problem Statement](#problem-statement)
-   [Key Features](#key-features)
-   [Technology Stack](#technology-stack)
-   [System Architecture](#system-architecture)
-   [Security and Privacy](#security-and-privacy)
-   [Target Audience](#target-audience)
-   [Prerequisites](#prerequisites)
-   [Getting Started](#getting-started)
-   [Environment Variables](#environment-variables)
-   [OCR Setup](#ocr-setup)
-   [Running the Application](#running-the-application)
-   [Deployment](#deployment)
-   [Safety Notes](#safety-notes)
-   [Future Enhancements](#future-enhancements)
-   [Contributing](#contributing)
-   [License](#license)

------------------------------------------------------------------------

## Overview

Medical information is often spread across lab reports, prescriptions,
imaging reports, and discharge summaries. HealthSaathi AI brings these
records together and helps users understand them in clear, accessible
language.

The platform is designed to:

-   Explain medical terminology in plain language using uploaded records
    as context.
-   Support text and voice interactions in English, Hindi, and Telugu.
-   Extract and classify information from digital and scanned medical
    documents.
-   Organize records, medicines, appointments, and follow-ups in one
    place.
-   Provide reminders for medicine schedules and upcoming appointments.
-   Protect each user's records through authenticated, owner-scoped
    access.

## Problem Statement

HealthSaathi AI addresses several common challenges:

1.  **Medical literacy gap:** Clinical terminology can be difficult for
    patients and caregivers to understand.
2.  **Language barriers:** English-first digital tools may be difficult
    to use for people who prefer regional languages.
3.  **Scattered health records:** Paper prescriptions and reports can be
    misplaced or difficult to retrieve.
4.  **Medication adherence:** Patients may forget doses, refills, or
    follow-up visits.
5.  **Unreliable AI answers:** General-purpose chatbots may provide
    answers that are not grounded in a patient's records.

## Key Features

### 1. Multilingual Clinical Copilot

-   Conversational AI powered by Groq and `llama-3.3-70b-versatile`.
-   Answers questions using relevant uploaded medical documents as
    context.
-   Explains medical terms in plain language.
-   Supports English, Hindi, and Telugu interactions.
-   Uses safety guardrails to identify potential emergency language and
    direct users to appropriate emergency services.

**Grounding principle:** Responses about a user's records should rely on
retrieved, authorized documents. If relevant information is missing or
unclear, the system should say so rather than inventing an answer.

### 2. Voice-Powered Consultation

-   Speech-to-text using Groq Whisper Large v3 Turbo.
-   Allows users to speak questions instead of typing.
-   Designed to make the interface more accessible to elderly users and
    people who find typing difficult.
-   Intended for English, Hindi, and Telugu voice workflows, subject to
    model and deployment support.

### 3. Smart Document OCR and Medical Extraction

The document pipeline supports multiple extraction methods:

-   **PyMuPDF:** Extracts text from digital PDFs.
-   **Pillow:** Supports image preprocessing.
-   **Tesseract OCR:** Extracts text from scanned documents and images.
-   **Optional AWS Textract:** Can be configured as a cloud-based
    fallback for supported forms and tables.

Typical processing stages:

1.  Upload and validate a document.
2.  Detect whether the PDF contains extractable text.
3.  Extract digital text with PyMuPDF when possible.
4.  Preprocess scanned pages and images with Pillow.
5.  Run OCR with the configured Tesseract language packs.
6.  Normalize and structure extracted text.
7.  Classify the document and store it under the authenticated owner.
8.  Make authorized extracted content available for document-grounded
    questions.

Supported document categories may include:

-   Lab reports
-   Prescriptions
-   Imaging and radiology reports
-   Invoices
-   Discharge summaries and general medical records

OCR output can contain mistakes, especially for handwriting, low-quality
scans, and complex layouts. Users should verify extracted details
against the original document.

### 4. Medication and Appointment Management

-   Track medicine names, dosage details, schedules, and food timing.
-   Record refill dates and medication notes.
-   Manage doctor appointments and follow-up visits.
-   View upcoming and past appointments.
-   Keep records associated with the appropriate authenticated user.

Medication information should be entered or confirmed using a
clinician's instructions or the original prescription. The platform
should not independently prescribe medicines or change dosages.

### 5. Reminders and Notifications

-   Background worker for checking upcoming medication doses and
    appointments.
-   In-app notifications with unread indicators.
-   Firebase Cloud Messaging (FCM) integration for supported
    push-notification workflows.
-   Browser Web Push using VAPID, where configured.
-   Optional reminder delivery when the browser tab is closed, subject
    to browser permissions, service-worker setup, and deployment
    configuration.

### 6. Localization and Preferences

-   Three-language interface: English, Hindi, and Telugu.
-   UI translations managed with `i18next`.
-   Persistent language preference associated with the user's profile.
-   Localized labels, navigation, and supported notification messages.

------------------------------------------------------------------------

## Technology Stack

  -----------------------------------------------------------------------
  Layer                               Technologies
  ----------------------------------- -----------------------------------
  Frontend                            React 18, Vite, Tailwind CSS v4,
                                      Lucide Icons

  Localization                        `i18next`

  Frontend notifications              Firebase Web SDK

  Backend API                         Node.js 20, Express, TypeScript,
                                      Zod

  Database                            MongoDB Atlas

  Authentication                      Firebase Authentication
                                      (email/password and Google OAuth,
                                      when configured)

  Token verification                  Firebase Admin SDK

  Conversational AI                   Groq API, `llama-3.3-70b-versatile`

  Speech-to-text                      Groq Whisper Large v3 Turbo

  PDF extraction                      PyMuPDF

  Image processing                    Pillow

  OCR                                 Tesseract OCR with `eng`, `hin`,
                                      and `tel` language data

  Optional document extraction        AWS Textract

  Push notifications                  Firebase Cloud Messaging and Web
                                      Push/VAPID

  Frontend hosting                    Vercel or Firebase Hosting

  Backend hosting                     Google Cloud Run

  Containerization                    Docker and Docker Compose
  -----------------------------------------------------------------------

Exact model availability, API names, and provider capabilities can
change. Verify the configured model identifiers against the provider's
current documentation before deployment.

## System Architecture

``` text
                    ┌──────────────────────────────┐
                    │       React + Vite UI        │
                    │ English / Hindi / Telugu     │
                    └──────────────┬───────────────┘
                                   │ HTTPS
                    ┌──────────────▼───────────────┐
                    │       Express API             │
                    │ TypeScript + Zod Validation   │
                    └───────┬──────────────┬────────┘
                            │              │
                 ┌──────────▼─────┐  ┌─────▼────────────┐
                 │ Firebase Auth  │  │ MongoDB Atlas    │
                 │ Token Verify   │  │ User-scoped data │
                 └────────────────┘  └──────────────────┘
                            │
             ┌──────────────┼───────────────────┐
             │              │                   │
    ┌────────▼──────┐ ┌─────▼────────┐ ┌────────▼────────┐
    │ Groq AI / STT │ │ OCR Service  │ │ Reminder Worker │
    │ Chat + Voice  │ │ PDF + Images │ │ FCM / Web Push  │
    └───────────────┘ └──────────────┘ └─────────────────┘
```

The diagram represents the intended high-level design. Actual
integrations depend on the services and modules implemented in the
repository.

## Security and Privacy

HealthSaathi AI is intended to handle sensitive medical information, so
security must be built into every layer.

-   **Authentication:** Verify Firebase ID tokens on protected backend
    endpoints.
-   **Owner-scoped access:** Apply the authenticated user's ID to every
    medical-record, document, and conversation query.
-   **Authorization:** Never trust a client-supplied owner ID; derive
    the owner from the verified server-side identity.
-   **Secret management:** Keep Groq, Firebase Admin, database, and
    other private credentials on the server or in a managed secret
    store.
-   **Input validation:** Validate request bodies, query parameters,
    file types, and file sizes.
-   **File handling:** Restrict uploads, use safe filenames, and avoid
    exposing uploaded files through public URLs.
-   **Transport security:** Use HTTPS in deployed environments.
-   **Data lifecycle:** Define retention, export, deletion, backup, and
    recovery policies.
-   **Auditability:** Record appropriate security events without logging
    unnecessary medical content or secrets.
-   **Least privilege:** Give services and database users only the
    permissions they need.

Any claim of HIPAA compliance or other regulatory compliance requires a
separate assessment of the deployed system, organizational practices,
vendors, contracts, and applicable laws. Technical features alone do not
establish compliance.

------------------------------------------------------------------------

## Target Audience

1.  **Patients and families:** Organize medical documents and better
    understand reports.
2.  **Elderly users and regional-language speakers:** Use supported
    local-language and voice workflows.
3.  **Caregivers:** Help organize records and appointments for family
    members with appropriate authorization.
4.  **People managing recurring care:** Keep track of reports,
    prescribed medicines, and follow-up schedules.

## Prerequisites

Install and configure the tools required by the parts of the application
you intend to run:

-   Node.js 20 or a compatible supported version
-   npm
-   Python 3
-   MongoDB Atlas account or a compatible MongoDB deployment
-   Firebase project with Authentication configured
-   Groq API key
-   Tesseract OCR with required language data
-   Git
-   Optional: AWS account for Textract, Firebase Cloud Messaging, and
    Google Cloud Run

The project uses multiple runtimes. Check the repository's
`package.json`, Python dependency file, Docker configuration, and
deployment settings for the exact supported versions.

## Getting Started

The commands below are a general setup template. Adjust paths and script
names to match the actual repository.

### 1. Clone the repository

``` bash
git clone <YOUR_REPOSITORY_URL>
cd HealthSaathi-AI
```

### 2. Install frontend and backend dependencies

If the repository has separate frontend and backend folders:

``` bash
cd frontend
npm install
cd ../backend
npm install
```

If the repository uses a different folder structure, run `npm install`
in each directory that contains its own `package.json`.

### 3. Install Python dependencies

If the OCR service has a `requirements.txt` file:

``` bash
python -m venv .venv
```

Activate the environment:

**Windows PowerShell**

``` powershell
.venv\Scripts\Activate.ps1
```

**macOS / Linux**

``` bash
source .venv/bin/activate
```

Then install the dependencies:

``` bash
pip install -r requirements.txt
```

Ensure that Tesseract is installed separately and that its executable
and language-data files are available to the OCR service.

### 4. Configure external services

Create local environment files based on the project's example files,
such as `.env.example`. Add the required MongoDB, Firebase, and Groq
configuration. Never commit real credentials.

### 5. Start the services

Use the scripts actually defined in each `package.json` and the OCR
service's startup instructions. Example commands may be:

``` bash
# Frontend directory
npm run dev
```

``` bash
# Backend directory — only if this script exists
npm run dev
```

Start the Python OCR service using its configured entry point. The exact
command depends on the framework and project structure.

------------------------------------------------------------------------

## Environment Variables

Create environment files locally and document the required variables in
`.env.example`. Variable names below are illustrative; align them with
the application's actual configuration.

### Backend

``` dotenv
NODE_ENV=development
PORT=5000
MONGODB_URI=<YOUR_MONGODB_CONNECTION_STRING>
GROQ_API_KEY=<YOUR_GROQ_API_KEY>
FIREBASE_PROJECT_ID=<YOUR_FIREBASE_PROJECT_ID>
FIREBASE_CLIENT_EMAIL=<YOUR_FIREBASE_SERVICE_ACCOUNT_EMAIL>
FIREBASE_PRIVATE_KEY=<YOUR_FIREBASE_PRIVATE_KEY>
```

### Frontend

Only public configuration values intended for browser use should be
exposed through Vite variables. Vite variables prefixed with `VITE_` are
included in the client bundle and must never contain private secrets.

``` dotenv
VITE_API_BASE_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=<YOUR_FIREBASE_WEB_API_KEY>
VITE_FIREBASE_AUTH_DOMAIN=<YOUR_FIREBASE_AUTH_DOMAIN>
VITE_FIREBASE_PROJECT_ID=<YOUR_FIREBASE_PROJECT_ID>
VITE_FIREBASE_APP_ID=<YOUR_FIREBASE_APP_ID>
```

### Optional integrations

Depending on which features are implemented, configuration may also be
needed for:

-   AWS Textract credentials and region
-   Firebase Cloud Messaging
-   Web Push VAPID public/private keys
-   OCR executable and language-data paths
-   Allowed frontend origins / CORS
-   Upload size and file-type limits

Use a managed secret store in production. Do not put service-account
JSON files, private keys, or API secrets in the frontend, source
control, logs, or README.

## OCR Setup

Tesseract needs the language data for every language the OCR workflow
supports. Common language codes are:

-   `eng` --- English
-   `hin` --- Hindi
-   `tel` --- Telugu

Check the installed language packs with:

``` bash
tesseract --list-langs
```

The required language data must be installed and discoverable by
Tesseract. OCR quality depends on image resolution, document layout,
handwriting, and language support.

## Running the Application

A typical local development workflow includes:

1.  Start MongoDB connectivity and verify the database configuration.
2.  Start the Express backend.
3.  Start the Python OCR service, if it runs independently.
4.  Start the React/Vite frontend.
5.  Sign in using a configured Firebase Authentication provider.
6.  Upload a test document that contains no real personal medical
    information.
7.  Verify extraction, record ownership, document-grounded questions,
    language switching, and reminder behavior.

Before considering a feature complete, test both successful and failure
cases, including invalid tokens, unauthorized record access, malformed
uploads, OCR errors, provider timeouts, and missing document context.

## Deployment

The proposed deployment setup is:

-   **Frontend:** Vercel or Firebase Hosting.
-   **Backend:** Google Cloud Run.
-   **Database:** MongoDB Atlas.
-   **Authentication:** Firebase Authentication.
-   **AI and speech:** Groq API.
-   **Document extraction:** Python OCR service, potentially
    containerized with Tesseract.
-   **Notifications:** Firebase Cloud Messaging and/or Web Push.

Before deploying:

-   Configure production environment variables and secrets.
-   Restrict CORS to trusted frontend origins.
-   Enforce HTTPS.
-   Configure MongoDB network access and least-privilege credentials.
-   Ensure every protected endpoint verifies identity and enforces
    record ownership.
-   Configure upload limits, timeouts, logging, and error handling.
-   Set up the service worker and notification permissions if Web Push
    is enabled.
-   Verify the container includes compatible Node.js, Python, and
    Tesseract dependencies.
-   Test the deployed application using synthetic or de-identified data.

## Safety Notes

-   HealthSaathi AI provides informational support and is not a
    diagnostic system or a replacement for a clinician.
-   Users should confirm medical interpretations and medication details
    with qualified healthcare professionals.
-   AI-generated explanations may be incomplete or incorrect even when
    grounded in documents.
-   OCR may misread drug names, doses, dates, test values, and reference
    ranges.
-   Emergency detection is not guaranteed to identify every emergency.
    Do not wait for an AI response in an emergency. In India, call
    **112** for emergency assistance; elsewhere, use the local emergency
    number.
-   Do not use real patient records for development or demonstrations
    unless appropriate consent, access controls, and safeguards are in
    place.

## Future Enhancements

Potential improvements include:

-   Medical trend charts for supported lab measurements.
-   Better extraction and validation of structured medical data.
-   Caregiver access with explicit consent and role-based permissions.
-   Downloadable medical-record summaries.
-   More robust reminder delivery and notification preferences.
-   Accessibility improvements and additional Indian languages.
-   Evaluation suites for document-grounded answers, translation
    quality, OCR accuracy, and emergency handling.
-   Security reviews, privacy impact assessments, and compliance review
    for intended deployment environments.

## Contributing

Contributions, bug reports, and feature suggestions are welcome.

1.  Fork the repository.
2.  Create a feature branch.
3.  Make a focused change.
4.  Add or update tests where appropriate.
5.  Submit a pull request with a clear description of the change.

Do not include real patient records, API keys, service-account
credentials, or other sensitive information in issues, commits,
screenshots, or test fixtures.

## License

Add the license that applies to this project before distributing it. If
no license has been selected, the project should not be assumed to be
open source.

------------------------------------------------------------------------

**HealthSaathi AI --- Making health information easier to understand,
access, and manage.**
