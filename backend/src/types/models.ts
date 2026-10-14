import { ObjectId } from 'mongodb';

// ─── Shared base ─────────────────────────────────────────────────────────────

export interface BaseDoc {
  _id?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: number;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface UserPreferences {
  language: string;
  preferredLanguage?: string;
  hasSelectedLanguage?: boolean;
  notifications: boolean;
  accessibility: { highContrast: boolean; fontSize: string };
}

export interface UserDoc extends BaseDoc {
  firebaseUid: string;
  email: string;
  displayName?: string;
  fullName?: string;
  avatar?: string;
  phone?: string;
  dateOfBirth?: string;
  location?: string;
  bloodGroup?: string;
  age?: number | string;
  city?: string;
  allergies?: string;
  conditions?: string;
  healthNotes?: string;
  emergencyContact?: string;
  preferences: UserPreferences;
  fcmTokens?: string[];
  consent: { acceptedAt?: Date; version?: string };
}

// ─── Documents ────────────────────────────────────────────────────────────────

export type DocumentStatus =
  | 'UPLOADING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY'
  | 'READY_WITH_WARNINGS'
  | 'FAILED'
  | 'DELETED';

export type DocumentType =
  | 'LAB_REPORT'
  | 'PRESCRIPTION'
  | 'DISCHARGE_SUMMARY'
  | 'SCAN'
  | 'VACCINATION'
  | 'OTHER';

export interface StorageMeta {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
}

export type ProcessingStage =
  | 'QUEUED'
  | 'EXTRACTING_TEXT'
  | 'RUNNING_OCR'
  | 'GENERATING_SUMMARY'
  | 'COMPLETED'
  | 'FAILED';

export interface OcrMetadata {
  pageCount: number;
  ocrPagesCount: number;
  embeddedPagesCount: number;
  avgConfidence?: number | null;
  processingDurationMs?: number;
}

export interface TokenUsageMeta {
  estimatedPromptTokens: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface DocumentDoc extends BaseDoc {
  ownerId: string;
  name: string;
  originalFilename: string;
  documentType: DocumentType;
  documentDate?: Date;
  status: DocumentStatus;
  processingStage?: ProcessingStage;
  description?: string;
  storage: StorageMeta;
  summary?: string;
  extractedText?: string;
  isMedicalDocument?: boolean;
  classification?: string;
  classificationConfidence?: number;
  classificationReason?: string;
  localFilePath?: string;
  fileBuffer?: Buffer;
  ocrProvider?: string;
  processingWarnings?: string[];
  ocrMetadata?: OcrMetadata;
  tokenUsage?: TokenUsageMeta;
  isTruncated?: boolean;
  processingJobId?: ObjectId;
  findingsCount?: number;
  deletedAt?: Date;
  failureCode?: string;
}

// ─── Findings ─────────────────────────────────────────────────────────────────

export type FindingStatus = 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL' | 'UNKNOWN';

export interface FindingDoc extends BaseDoc {
  ownerId: string;
  documentId: ObjectId;
  category: string;
  testName: string;
  result: string;
  unit?: string;
  referenceRange?: string;
  referenceLow?: number;
  referenceHigh?: number;
  status: FindingStatus;
  occurredAt?: Date;
  source: 'EXTRACTED' | 'MANUAL';
}

// ─── Medicines ────────────────────────────────────────────────────────────────

export type MedicineStatus = 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'DISCONTINUED';

export interface MedicineDoc extends BaseDoc {
  ownerId: string;
  name: string;
  strength?: string;
  frequency?: string;
  timing?: string;
  startDate?: Date;
  endDate?: Date;
  status: MedicineStatus;
  notes?: string;
  lastNotifiedAt?: Date;
  deletedAt?: Date;
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
export type VisitType = 'IN_PERSON' | 'TELEMEDICINE' | 'HOME_VISIT';

export interface AppointmentDoc extends BaseDoc {
  ownerId: string;
  doctorName: string;
  specialty?: string;
  scheduledAt: Date;
  timezone: string;
  location?: string;
  visitType: VisitType;
  notes?: string;
  status: AppointmentStatus;
  notified24h?: boolean;
  notified1h?: boolean;
  deletedAt?: Date;
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export type ReminderCategory = 'MEDICINE' | 'APPOINTMENT' | 'GENERAL' | 'TEST';
export type RepeatInterval = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface ReminderDoc extends BaseDoc {
  ownerId: string;
  title: string;
  category: ReminderCategory;
  scheduledAtLocal: string;
  timezone: string;
  repeat: RepeatInterval;
  enabled: boolean;
  completedAt?: Date;
  nextOccurrenceAt?: Date;
  notes?: string;
  lastNotifiedAt?: Date;
  deletedAt?: Date;
}

// ─── Conversations & Messages ─────────────────────────────────────────────────

export interface ConversationDoc extends BaseDoc {
  ownerId: string;
  title?: string;
  lastMessagePreview?: string;
  sourceDocumentIds: ObjectId[];
  lastMessageAt?: Date;
  deletedAt?: Date;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface MessageDoc extends BaseDoc {
  ownerId: string;
  conversationId: ObjectId;
  role: MessageRole;
  content: string;
  sourceDocumentIds: ObjectId[];
  model?: string;
  safety?: { triggered: boolean; category?: string };
  usage?: { promptTokens: number; completionTokens: number };
  providerRequestId?: string;
  deletedAt?: Date;
}

// ─── Processing Jobs ──────────────────────────────────────────────────────────

export type JobType = 'DOCUMENT_PROCESSING' | 'ACCOUNT_DELETION' | 'OBJECT_PURGE';
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';

export interface ProcessingJobDoc extends BaseDoc {
  ownerId: string;
  documentId?: ObjectId;
  type: JobType;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  idempotencyKey: string;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: Date;
  finishedAt?: Date;
  nextRetryAt?: Date;
  payload?: Record<string, unknown>;
}

// ─── Audit Events ─────────────────────────────────────────────────────────────

export interface AuditEventDoc {
  _id?: ObjectId;
  actorUid: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId: string;
  ipHash?: string;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
}

// ─── Persistent Clinical Memories ───────────────────────────────────────────

export type MemoryCategory =
  | 'CHRONIC_CONDITION'
  | 'ALLERGY'
  | 'SURGICAL_HISTORY'
  | 'PHYSICAL_RESTRICTION'
  | 'DIETARY_PREFERENCE'
  | 'FAMILY_HISTORY'
  | 'OTHER_PRECAUTION';

export interface ClinicalMemoryDoc extends BaseDoc {
  ownerId: string;
  subject: string; // 'SELF' | 'FATHER' | 'MOTHER' | 'SPOUSE' | 'CHILD' | other relation/name
  category: MemoryCategory;
  fact: string; // e.g. "History of cardiovascular / heart disease"
  clinicalPrecaution?: string; // e.g. "Advise low-to-moderate intensity exercises only (e.g. walking); avoid heavy cardio/strain"
  sourceText: string; // User excerpt that triggered the memory
  sourceConversationId?: ObjectId;
  confidence: number;
  deletedAt?: Date;
}

// ─── Notifications & Reminders ───────────────────────────────────────────────

export type NotificationType =
  | 'MEDICINE_SCHEDULE'
  | 'APPOINTMENT_REMINDER'
  | 'LAB_REPORT_READY'
  | 'GENERAL';

export interface NotificationDoc extends BaseDoc {
  ownerId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, string>;
  read: boolean;
  fcmSent?: boolean;
  deletedAt?: Date | null;
}

