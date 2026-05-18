export const SYNC_STATUS = {
  pending: "pending",
  syncing: "syncing",
  synced: "synced",
  failed: "failed",
  deleted: "deleted",
};

export const modelSchemas = {
  patients: {
    primaryKey: "localId",
    required: ["name", "phone", "village", "consent"],
    offlineFirst: true,
    syncEndpoint: "patients",
    fields: {
      name: "string",
      phone: "string",
      village: "string",
      dob: "date",
      gravida: "number",
      lmpDate: "date",
      consent: "object",
      riskSnapshot: "object",
      sync: "syncMetadata",
    },
  },
  surveys: {
    primaryKey: "localId",
    required: ["patientLocalId", "steps", "consent"],
    offlineFirst: true,
    syncEndpoint: "surveys",
    fields: {
      patientLocalId: "string",
      steps: "object",
      riskOutput: "object",
      consent: "object",
      sync: "syncMetadata",
    },
  },
  mcpMeasurements: {
    primaryKey: "localId",
    required: ["patientLocalId", "type", "measuredAt"],
    offlineFirst: true,
    syncEndpoint: "mcp",
    fields: {
      patientLocalId: "string",
      type: "anc|immunization|growth",
      payload: "object",
      sync: "syncMetadata",
    },
  },
  followups: {
    primaryKey: "localId",
    required: ["patientLocalId", "dueDate", "reason"],
    offlineFirst: true,
    syncEndpoint: "followups",
    fields: {
      patientLocalId: "string",
      dueDate: "date",
      reason: "string",
      completedAt: "date",
      sync: "syncMetadata",
    },
  },
  consents: {
    primaryKey: "localId",
    required: ["patientLocalId", "purpose", "acceptedAt"],
    offlineFirst: true,
    syncEndpoint: "consents",
    fields: {
      patientLocalId: "string",
      purpose: "string",
      version: "string",
      acceptedAt: "date",
      language: "en|hi",
      sync: "syncMetadata",
    },
  },
  auditEvents: {
    primaryKey: "localId",
    required: ["eventType", "actorId", "createdAt"],
    offlineFirst: true,
    syncEndpoint: "auditEvents",
    fields: {
      eventType: "string",
      actorId: "string",
      entityType: "string",
      entityLocalId: "string",
      metadata: "object",
      sync: "syncMetadata",
    },
  },
};

export function createSyncMetadata({ now, deviceId, remoteId } = {}) {
  const timestamp = now || new Date().toISOString();
  return {
    deviceId: deviceId || "pilot-device",
    remoteId: remoteId || null,
    syncStatus: SYNC_STATUS.pending,
    version: 1,
    lastModifiedAt: timestamp,
    createdAt: timestamp,
    deletedAt: null,
  };
}
