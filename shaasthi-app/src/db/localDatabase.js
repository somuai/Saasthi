import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSyncMetadata, modelSchemas, SYNC_STATUS } from "./schemas";

const STORAGE_KEY = "shaasthi.localdb.v1";

function randomId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class LocalDatabase {
  constructor({ storage = AsyncStorage, now = () => new Date().toISOString(), idFactory = randomId } = {}) {
    this.storage = storage;
    this.now = now;
    this.idFactory = idFactory;
    this.collections = Object.keys(modelSchemas).reduce((acc, name) => {
      acc[name] = {};
      return acc;
    }, {});
  }

  async hydrate() {
    const raw = await this.storage.getItem(STORAGE_KEY);
    if (raw) this.collections = { ...this.collections, ...JSON.parse(raw) };
    return this;
  }

  async persist() {
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(this.collections));
  }

  withLocalWrite(collection, record, previous) {
    const timestamp = this.now();
    const localId = record.localId || previous?.localId || this.idFactory(collection);
    const sync = previous?.sync
      ? {
          ...previous.sync,
          ...record.sync,
          syncStatus: SYNC_STATUS.pending,
          version: (previous.sync.version || 1) + 1,
          lastModifiedAt: timestamp,
        }
      : createSyncMetadata({ now: timestamp, deviceId: record.deviceId });

    return {
      ...previous,
      ...record,
      localId,
      sync,
      updatedAt: timestamp,
      createdAt: previous?.createdAt || timestamp,
    };
  }

  async upsert(collection, record) {
    this.assertCollection(collection);
    const previous = this.collections[collection][record.localId];
    const next = this.withLocalWrite(collection, record, previous);
    this.collections[collection][next.localId] = next;
    await this.persist();
    return next;
  }

  async create(collection, record) {
    return this.upsert(collection, record);
  }

  async softDelete(collection, localId) {
    this.assertCollection(collection);
    const previous = this.collections[collection][localId];
    if (!previous) return null;
    const next = this.withLocalWrite(collection, {
      localId,
      sync: { deletedAt: this.now(), syncStatus: SYNC_STATUS.deleted },
    }, previous);
    next.sync.syncStatus = SYNC_STATUS.deleted;
    this.collections[collection][localId] = next;
    await this.persist();
    return next;
  }

  find(collection, localId) {
    this.assertCollection(collection);
    return this.collections[collection][localId] || null;
  }

  query(collection, predicate = () => true) {
    this.assertCollection(collection);
    return Object.values(this.collections[collection]).filter(predicate);
  }

  getPendingChanges() {
    return Object.entries(this.collections).flatMap(([collection, records]) =>
      Object.values(records)
        .filter((record) => record.sync?.syncStatus !== SYNC_STATUS.synced)
        .map((record) => ({ collection, record }))
    );
  }

  async markSynced(collection, localId, remoteId) {
    this.assertCollection(collection);
    const record = this.collections[collection][localId];
    if (!record) return null;
    const next = {
      ...record,
      sync: {
        ...record.sync,
        remoteId: remoteId || record.sync.remoteId,
        syncStatus: SYNC_STATUS.synced,
        lastSyncedAt: this.now(),
      },
    };
    this.collections[collection][localId] = next;
    await this.persist();
    return next;
  }

  async addAuditEvent(event) {
    return this.create("auditEvents", {
      actorId: "asha-pilot-user",
      createdAt: this.now(),
      ...event,
    });
  }

  assertCollection(collection) {
    if (!modelSchemas[collection]) {
      throw new Error(`Unknown SHAASTHI collection: ${collection}`);
    }
  }
}

export const localDb = new LocalDatabase();
