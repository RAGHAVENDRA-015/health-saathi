# HealthSaathi AI — Production Bug Audit and Targeted Fixes

## Workflow Rules
- Use **ECC only** for this task. Do not invoke GSD.
- Audit the existing repository, architecture, and deployment configuration before changing code.
- Do not rewrite the application or perform unnecessary refactoring.
- Preserve the existing UI design, features, routes, business logic, database structure, and working functionality unless a specific change is required to fix one of the issues below.
- Do not modify unrelated files or introduce unnecessary dependencies.
- Analyze the console-error screenshots and existing logs available in the project or task attachments. Inspect browser console errors, network requests, and deployment logs where available.
- Implement the changes directly in the existing project, then run the relevant tests and report the actual results. Do not claim that a feature works unless it has been verified.

## Existing Technology Stack
- Frontend: React
- Backend: Express.js
- Authentication: Firebase Authentication
- Database: MongoDB
- Deployment: Existing online frontend and backend hosting platforms

First, inspect the repository to confirm the actual stack, application entry points, authentication flow, chat components, speech-to-text implementation, environment variables, and deployment configuration. Adapt the implementation to the existing architecture rather than assuming any file names or creating duplicate implementations.

## Phase 1 — Audit the Entire Application

Perform a targeted production-readiness audit before making changes.

1. Trace the complete authentication flow, from login and registration through page refresh, browser closure, reopening the deployed URL, logout, and session expiration.
2. Inspect Firebase initialization, authentication persistence settings, `onAuthStateChanged` or the existing equivalent, protected routes, loading states, and redirect logic.
3. Trace the STT workflow from microphone permission to recording, audio processing, API request, transcription response, and text insertion into the chat input.
4. Check deployed frontend and backend environment variables, API URLs, CORS configuration, HTTPS requirements, browser microphone restrictions, and relevant network failures.
5. Check the existing mobile layouts for overflow, clipped content, incorrect spacing, unusable controls, and horizontal scrolling.
6. Identify the actual root cause of each confirmed error before implementing its fix.

Create a concise internal or repository-appropriate audit report identifying the affected files, root causes, and minimum necessary changes.

## Phase 2 — Fix Login Persistence and Automatic Session Restoration

**Objective:** A returning user should not have to log in every time they close and reopen the application.

1. Configure Firebase Authentication to use the appropriate persistent browser authentication mode, preferably Firebase's local persistence for the web application.
2. Ensure authenticated users remain signed in across page refreshes, tab closure, browser restarts, and subsequent visits to the deployed URL, subject to the selected session policy and browser storage availability.
3. Implement or repair the application's authentication initialization flow:
   - While Firebase is restoring the authentication state, show an appropriate loading state.
   - Do not prematurely redirect the user to the login page or splash screen.
   - Once the authentication state is resolved, navigate authenticated users directly to the home/chat page.
   - Navigate unauthenticated users to the existing login or welcome flow.
4. Eliminate unnecessary login redirects, authentication-state flickering, duplicate Firebase listeners, and initialization race conditions.
5. Ensure protected routes wait for authentication initialization before deciding whether to redirect.
6. Verify that logout clears the user's authenticated application state and returns the user to the login screen.
7. Ensure a user who signs out cannot continue accessing protected application features through stale frontend state.
8. Preserve proper user isolation. Never display another user's conversations, documents, or private information after login or logout.

### Session duration policy

Use a **seven-day application session policy** unless the existing project requirements specify otherwise. Keep users authenticated across browser restarts during this period, and require login again after the configured expiry or an explicit logout.

Use reliable timestamps and appropriate handling of session expiration. Do not mistake Firebase's normal token-refresh behavior for a reason to log the user out.

If enforcing an absolute seven-day limit requires backend session validation, implement it using the existing backend and Firebase verification flow only where necessary. Do not rely solely on an editable frontend timestamp as a security boundary.

Do not store passwords, Firebase service-account credentials, or sensitive authentication tokens manually in custom local storage.

## Phase 3 — Fix Speech-to-Text After Deployment

**Objective:** STT must work on the deployed application, not only in the local development environment.

1. Trace the complete STT implementation and identify the exact failure using existing screenshots, console errors, backend logs, and failed network requests.
2. Check microphone permission handling, browser support, secure-context requirements, audio recording compatibility, file MIME types, audio size limits, API timeouts, CORS, and error handling.
3. Verify that the deployed frontend points to the correct production backend endpoint rather than localhost or another development URL.
4. If the existing implementation uses Groq for speech-to-text, verify that `GROQ_API_KEY_STT` is configured in the deployed **backend** environment and read by the existing STT implementation.
5. Never expose the Groq API key or other private API credentials in frontend code, client-side environment variables, browser storage, or network responses.
6. Verify the correct API endpoint, request format, supported audio format, transcription model, and current provider requirements against the existing implementation and official documentation.
7. Correct environment-variable name mismatches, missing production configuration, invalid API requests, response parsing failures, and incorrect error handling when confirmed.
8. Preserve the existing STT provider and architecture wherever possible. Do not switch providers or introduce a new billing dependency unless a confirmed technical limitation requires it.
9. Ensure that:
   - The microphone permission request is handled correctly.
   - The UI indicates recording and transcription states.
   - Transcribed text appears in the existing chat input.
   - The user can edit the transcription before sending.
   - Denied permissions, empty recordings, unsupported browsers, API errors, and network failures produce clear user-facing messages.
   - The microphone, recording, loading, and error states reset correctly after success or failure.
10. Ensure STT failures do not crash the chat page or interfere with normal text-based messaging.

## Phase 4 — Improve Mobile Responsiveness

**Objective:** Make the existing application comfortable to use on mobile devices while preserving its desktop experience.

Perform a mobile-first responsive audit of the main pages and existing application components.

1. Support narrow mobile screens, tablets, laptops, and larger desktop displays.
2. Fix horizontal overflow, clipped text, overlapping elements, excessive margins, inconsistent padding, and components extending beyond the viewport.
3. Improve the responsiveness of the login/register screens, welcome or splash screen, chat page, navigation/sidebar, chat input, buttons, forms, cards, and document-related interfaces.
4. On mobile:
   - Use a suitable responsive navigation pattern for the existing sidebar.
   - Ensure the chat input and send/microphone controls remain visible and easy to use.
   - Prevent the virtual keyboard from covering the active input or critical controls.
   - Make messages, long responses, code blocks, and document information readable without breaking the layout.
   - Use appropriate touch-target sizes and spacing.
   - Avoid unnecessary horizontal scrolling.
5. Use the existing styling system and responsive framework. Add or modify breakpoints only as needed.
6. Preserve existing desktop layouts and visual identity. Do not redesign unrelated screens or replace working components simply for stylistic reasons.

Validate at representative mobile widths, including approximately 320px, 375px, 390px, and 430px, along with tablet and desktop widths.

## Phase 5 — Remove the Watch Demo Option

1. Locate the existing welcome/splash screen and remove only the **Watch Demo** button or entry point.
2. Remove its associated click handler or demo-navigation logic only if it becomes unused and is safe to remove.
3. Preserve the existing login, registration, branding, and other useful welcome-screen elements.
4. Ensure new or unauthenticated users can proceed through the normal authentication flow without being directed to a demo.
5. Ensure authenticated returning users bypass the welcome/login flow and reach the home/chat page after authentication restoration.

Do not remove unrelated demo data, components, routes, or features without verifying that they are exclusively used by the Watch Demo functionality.

## Phase 6 — Testing and Verification

Run all relevant existing tests and add focused tests where appropriate.

### Authentication tests
- Successful login and registration.
- Authentication state restoration after page refresh.
- Authentication restoration after closing and reopening the browser.
- Directly visiting the deployed URL while already authenticated.
- Automatic session expiration according to the configured policy.
- Logout and subsequent access to protected routes.
- Correct separation of user-specific data.
- Handling of slow or failed Firebase initialization.

### STT tests
- Microphone permission granted and denied.
- Successful recording and transcription.
- Transcription inserted into the correct chat input.
- Empty or unsupported audio.
- Missing API key or invalid backend configuration.
- API timeout, provider error, and network failure.
- Production endpoint and environment-variable configuration.

### Responsive UI tests
- Login and registration on mobile.
- Chat page and input controls on mobile.
- Sidebar/navigation on mobile.
- Long messages and document information.
- No unintended horizontal overflow at the specified viewport widths.
- Desktop layout remains functional.

### Regression tests
- Existing login and registration methods.
- Text chat and conversation history.
- Document upload and analysis.
- Other existing application features affected by shared authentication, layout, or API code.

Run the available linting, type checks, build, and automated tests. Fix regressions introduced by this implementation. Do not disable failing tests to make the build pass.

## Final Acceptance Criteria

Consider the task complete only when the following have been verified or any remaining deployment limitation has been clearly documented:

- Returning users can reopen the deployed application without repeatedly logging in during the configured session period.
- Authentication initialization does not incorrectly show the welcome/login screen to an already authenticated user.
- Logout and user-data isolation work correctly.
- STT works through the deployed architecture when the provider configuration and browser permissions are valid.
- STT errors are handled gracefully and do not break text chat.
- The main application screens work properly on mobile and desktop.
- The Watch Demo button is removed without damaging the remaining welcome screen.
- Existing unrelated features remain intact.
- Production build and relevant tests pass, or failures are explicitly reported with their causes.

## Implementation Constraints

- Make the smallest reliable changes necessary to fix the identified root causes.
- Do not overwrite existing functionality or replace the authentication architecture unnecessarily.
- Do not hardcode API keys, production URLs, credentials, or secrets.
- Do not claim that local testing verifies production behavior.
- If a problem requires a hosting-dashboard change, environment-variable update, Firebase console setting, or real-device test, identify the exact action required.
- If a root cause cannot be verified, clearly distinguish the suspected cause from a confirmed finding.

## Final Report

After implementation, provide:

1. The confirmed root cause of each issue.
2. The files modified and a brief description of each change.
3. The authentication persistence policy and how expiry is enforced.
4. The STT failure cause and the exact fix.
5. The mobile responsiveness improvements completed.
6. The Watch Demo removal details.
7. Tests executed and their actual pass/fail results.
8. Any remaining manual deployment steps or unverified production behavior.

**Begin by auditing the current codebase and available console-error screenshots. Then implement the fixes in the phases above, preserving all unrelated functionality.**