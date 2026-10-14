import { MongoClient, Db, ObjectId } from 'mongodb';
import { getEnv } from './env';

let client: MongoClient;
let db: Db;

export async function connectMongo(): Promise<void> {
  const env = getEnv();
  client = new MongoClient(env.MONGODB_URI, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  });

  await client.connect();
  db = client.db(env.MONGODB_DB_NAME);
  console.log(`✅ MongoDB connected — db: ${env.MONGODB_DB_NAME}`);

  await createIndexes(db);
  await seedInitialRecords(db);
}

export function getDb(): Db {
  if (!db) throw new Error('MongoDB not initialized — call connectMongo() first');
  return db;
}

export async function closeMongo(): Promise<void> {
  if (client) await client.close();
}

async function createIndexes(db: Db): Promise<void> {
  // users
  await db.collection('users').createIndexes([
    { key: { firebaseUid: 1 }, unique: true },
    { key: { email: 1 } },
  ]);

  // documents
  await db.collection('documents').createIndexes([
    { key: { ownerId: 1, deletedAt: 1, documentDate: -1 } },
    { key: { ownerId: 1, documentType: 1, documentDate: -1 } },
    { key: { ownerId: 1, status: 1 } },
  ]);

  // findings
  await db.collection('findings').createIndexes([
    { key: { ownerId: 1, documentId: 1 } },
    { key: { ownerId: 1, category: 1, occurredAt: -1 } },
  ]);

  // medicines
  await db.collection('medicines').createIndexes([
    { key: { ownerId: 1, status: 1, updatedAt: -1 } },
  ]);

  // appointments
  await db.collection('appointments').createIndexes([
    { key: { ownerId: 1, scheduledAt: 1 } },
    { key: { ownerId: 1, deletedAt: 1 } },
  ]);

  // reminders
  await db.collection('reminders').createIndexes([
    { key: { ownerId: 1, enabled: 1, nextOccurrenceAt: 1 } },
    { key: { ownerId: 1, deletedAt: 1 } },
  ]);

  // conversations
  await db.collection('conversations').createIndexes([
    { key: { ownerId: 1, deletedAt: 1, lastMessageAt: -1 } },
    { key: { ownerId: 1, lastMessageAt: -1, _id: -1 } },
  ]);

  // messages
  await db.collection('messages').createIndexes([
    { key: { conversationId: 1, createdAt: 1 } },
    { key: { ownerId: 1, conversationId: 1, createdAt: 1 } },
    { key: { ownerId: 1, conversationId: 1, deletedAt: 1, createdAt: 1 } },
  ]);

  // processing_jobs
  await db.collection('processing_jobs').createIndexes([
    { key: { type: 1, idempotencyKey: 1 }, unique: true },
    { key: { documentId: 1 } },
    { key: { status: 1, createdAt: 1 } },
  ]);

  // clinical_memories
  await db.collection('clinical_memories').createIndexes([
    { key: { ownerId: 1, deletedAt: 1, updatedAt: -1 } },
    { key: { ownerId: 1, subject: 1, category: 1 } },
  ]);

  // audit_events
  await db.collection('audit_events').createIndexes([
    { key: { actorUid: 1, occurredAt: -1 } },
    { key: { occurredAt: 1 }, expireAfterSeconds: 60 * 60 * 24 * 365 },
  ]);

  console.log('✅ MongoDB indexes ensured');
}

async function seedInitialRecords(db: Db): Promise<void> {
  const demoUid = 'demo_user_001';
  const existingDocs = await db.collection('documents').countDocuments({ ownerId: demoUid });
  if (existingDocs > 0) return;

  const now = new Date();
  const bloodDocId = new ObjectId();
  const lipidDocId = new ObjectId();
  const thyroidDocId = new ObjectId();
  const rxDocId = new ObjectId();

  const documents = [
    {
      _id: bloodDocId,
      ownerId: demoUid,
      name: 'Blood Test Report',
      originalFilename: 'blood-test-oct-2026.pdf',
      documentType: 'LAB_REPORT',
      documentDate: new Date('2026-10-08'),
      status: 'READY',
      description: 'Routine Health Checkup — Complete Blood Count & Metabolic Panel',
      summary: 'Comprehensive routine hematology and metabolic assessment. Normal hemoglobin, fasting blood glucose, and leukocyte counts. Mild Vitamin D deficiency (28 ng/mL) and borderline elevated fasting triglycerides (162 mg/dL).',
      storage: {
        objectKey: `${demoUid}/blood-test-oct-2026.pdf`,
        contentType: 'application/pdf',
        sizeBytes: 154200,
        sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
      },
      findingsCount: 8,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      _id: lipidDocId,
      ownerId: demoUid,
      name: 'Lipid Profile',
      originalFilename: 'lipid-profile-jul-2026.pdf',
      documentType: 'LAB_REPORT',
      documentDate: new Date('2026-07-20'),
      status: 'READY',
      description: 'Cardiovascular Risk Assessment',
      summary: 'Fasting lipid panel evaluation showing elevated total cholesterol (202 mg/dL) and triglycerides (178 mg/dL) with normal HDL (42 mg/dL).',
      storage: {
        objectKey: `${demoUid}/lipid-profile-jul-2026.pdf`,
        contentType: 'application/pdf',
        sizeBytes: 112400,
        sha256: 'b2c3d4e5f60718293a4b5c6d7e8f90a1',
      },
      findingsCount: 4,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      _id: thyroidDocId,
      ownerId: demoUid,
      name: 'Thyroid Function Test',
      originalFilename: 'thyroid-panel-aug-2026.pdf',
      documentType: 'LAB_REPORT',
      documentDate: new Date('2026-08-14'),
      status: 'READY',
      description: 'Thyroid Hormones & TSH Screen',
      summary: 'Thyroid panel demonstrating mild subclinical TSH elevation (4.8 mIU/L) with normal circulating Free T4 (1.2 ng/dL).',
      storage: {
        objectKey: `${demoUid}/thyroid-panel-aug-2026.pdf`,
        contentType: 'application/pdf',
        sizeBytes: 98400,
        sha256: 'c3d4e5f60718293a4b5c6d7e8f90a1b2',
      },
      findingsCount: 2,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      _id: rxDocId,
      ownerId: demoUid,
      name: 'Prescription - Dr. Anil Mehta',
      originalFilename: 'rx-dr-mehta-sep-2026.pdf',
      documentType: 'PRESCRIPTION',
      documentDate: new Date('2026-09-15'),
      status: 'READY',
      description: 'Consultation & Prescription for Seasonal Allergies and Vitamin D Repletion',
      summary: 'Prescription for Vitamin D3 (60,000 IU weekly for 8 weeks), Cetirizine 10mg PRN, and routine metabolic follow-up.',
      storage: {
        objectKey: `${demoUid}/rx-dr-mehta-sep-2026.pdf`,
        contentType: 'application/pdf',
        sizeBytes: 76500,
        sha256: 'd4e5f60718293a4b5c6d7e8f90a1b2c3',
      },
      findingsCount: 0,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
  ];

  const findings = [
    {
      ownerId: demoUid,
      documentId: bloodDocId,
      category: 'BLOOD',
      testName: 'Hemoglobin',
      result: '13.2',
      unit: 'g/dL',
      referenceRange: '12.0 – 15.5',
      referenceLow: 12.0,
      referenceHigh: 15.5,
      status: 'NORMAL',
      occurredAt: new Date('2026-10-08'),
      source: 'EXTRACTED',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      ownerId: demoUid,
      documentId: bloodDocId,
      category: 'METABOLIC',
      testName: 'Blood Sugar (Fasting)',
      result: '92',
      unit: 'mg/dL',
      referenceRange: '70 – 99',
      referenceLow: 70,
      referenceHigh: 99,
      status: 'NORMAL',
      occurredAt: new Date('2026-10-08'),
      source: 'EXTRACTED',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      ownerId: demoUid,
      documentId: bloodDocId,
      category: 'LIPID',
      testName: 'Cholesterol (Total)',
      result: '189',
      unit: 'mg/dL',
      referenceRange: 'Below 200',
      referenceLow: 0,
      referenceHigh: 200,
      status: 'NORMAL',
      occurredAt: new Date('2026-10-08'),
      source: 'EXTRACTED',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      ownerId: demoUid,
      documentId: bloodDocId,
      category: 'VITAMINS',
      testName: 'Vitamin D (25-OH)',
      result: '28',
      unit: 'ng/mL',
      referenceRange: '30 – 100',
      referenceLow: 30,
      referenceHigh: 100,
      status: 'LOW',
      occurredAt: new Date('2026-10-08'),
      source: 'EXTRACTED',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      ownerId: demoUid,
      documentId: bloodDocId,
      category: 'BLOOD',
      testName: 'White Blood Cells (WBC)',
      result: '7.1',
      unit: '×10³/µL',
      referenceRange: '4.0 – 11.0',
      referenceLow: 4.0,
      referenceHigh: 11.0,
      status: 'NORMAL',
      occurredAt: new Date('2026-10-08'),
      source: 'EXTRACTED',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      ownerId: demoUid,
      documentId: bloodDocId,
      category: 'BLOOD',
      testName: 'Platelets',
      result: '245',
      unit: '×10³/µL',
      referenceRange: '150 – 410',
      referenceLow: 150,
      referenceHigh: 410,
      status: 'NORMAL',
      occurredAt: new Date('2026-10-08'),
      source: 'EXTRACTED',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      ownerId: demoUid,
      documentId: bloodDocId,
      category: 'VITAMINS',
      testName: 'Vitamin B12',
      result: '412',
      unit: 'pg/mL',
      referenceRange: '200 – 900',
      referenceLow: 200,
      referenceHigh: 900,
      status: 'NORMAL',
      occurredAt: new Date('2026-10-08'),
      source: 'EXTRACTED',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      ownerId: demoUid,
      documentId: bloodDocId,
      category: 'LIPID',
      testName: 'Triglycerides',
      result: '162',
      unit: 'mg/dL',
      referenceRange: 'Below 150',
      referenceLow: 0,
      referenceHigh: 150,
      status: 'HIGH',
      occurredAt: new Date('2026-10-08'),
      source: 'EXTRACTED',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      ownerId: demoUid,
      documentId: lipidDocId,
      category: 'LIPID',
      testName: 'Cholesterol (Total)',
      result: '202',
      unit: 'mg/dL',
      referenceRange: 'Below 200',
      referenceLow: 0,
      referenceHigh: 200,
      status: 'HIGH',
      occurredAt: new Date('2026-07-20'),
      source: 'EXTRACTED',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      ownerId: demoUid,
      documentId: lipidDocId,
      category: 'LIPID',
      testName: 'Triglycerides',
      result: '178',
      unit: 'mg/dL',
      referenceRange: 'Below 150',
      referenceLow: 0,
      referenceHigh: 150,
      status: 'HIGH',
      occurredAt: new Date('2026-07-20'),
      source: 'EXTRACTED',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      ownerId: demoUid,
      documentId: lipidDocId,
      category: 'LIPID',
      testName: 'HDL Cholesterol',
      result: '42',
      unit: 'mg/dL',
      referenceRange: '40 – 60',
      referenceLow: 40,
      referenceHigh: 60,
      status: 'NORMAL',
      occurredAt: new Date('2026-07-20'),
      source: 'EXTRACTED',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      ownerId: demoUid,
      documentId: lipidDocId,
      category: 'LIPID',
      testName: 'LDL Cholesterol',
      result: '125',
      unit: 'mg/dL',
      referenceRange: 'Below 100',
      referenceLow: 0,
      referenceHigh: 100,
      status: 'HIGH',
      occurredAt: new Date('2026-07-20'),
      source: 'EXTRACTED',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      ownerId: demoUid,
      documentId: thyroidDocId,
      category: 'THYROID',
      testName: 'TSH (Thyroid Stimulating Hormone)',
      result: '4.8',
      unit: 'mIU/L',
      referenceRange: '0.4 – 4.2',
      referenceLow: 0.4,
      referenceHigh: 4.2,
      status: 'HIGH',
      occurredAt: new Date('2026-08-14'),
      source: 'EXTRACTED',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      ownerId: demoUid,
      documentId: thyroidDocId,
      category: 'THYROID',
      testName: 'Free T4',
      result: '1.2',
      unit: 'ng/dL',
      referenceRange: '0.8 – 1.8',
      referenceLow: 0.8,
      referenceHigh: 1.8,
      status: 'NORMAL',
      occurredAt: new Date('2026-08-14'),
      source: 'EXTRACTED',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
  ];

  const medicines = [
    {
      ownerId: demoUid,
      name: 'Vitamin D3 Cholecalciferol',
      strength: '60,000 IU',
      frequency: 'Once weekly',
      timing: 'After breakfast on Sunday',
      startDate: new Date('2026-09-15'),
      status: 'ACTIVE',
      notes: '8-week course to replenish insufficient Vitamin D levels.',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      ownerId: demoUid,
      name: 'Atorvastatin',
      strength: '10 mg',
      frequency: 'Once daily',
      timing: 'At bedtime',
      startDate: new Date('2026-07-25'),
      status: 'ACTIVE',
      notes: 'For lipid optimization and cardiovascular protection.',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
    {
      ownerId: demoUid,
      name: 'Metformin',
      strength: '500 mg',
      frequency: 'Twice daily',
      timing: 'With meals (morning and evening)',
      startDate: new Date('2026-01-10'),
      status: 'ACTIVE',
      notes: 'Maintenance metabolic therapy.',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
  ];

  const appointments = [
    {
      ownerId: demoUid,
      doctorName: 'Dr. Anil Mehta',
      specialty: 'Internal Medicine & General Physician',
      clinicName: 'Apollo Medical Centre',
      scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'SCHEDULED',
      visitType: 'IN_PERSON',
      notes: 'Follow-up on repeat Vitamin D and lipid panel.',
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    },
  ];

  await db.collection('documents').insertMany(documents as never[]);
  await db.collection('findings').insertMany(findings as never[]);
  await db.collection('medicines').insertMany(medicines as never[]);
  await db.collection('appointments').insertMany(appointments as never[]);
  console.log(`✅ Seeded ${documents.length} patient documents, ${findings.length} findings, and clinical records for ${demoUid}`);
}

