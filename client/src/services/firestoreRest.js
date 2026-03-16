/**
 * Firestore REST API helper — bypasses the SDK's WebChannel transport
 * which can be unreliable on some networks. Uses standard fetch() instead.
 * Ported from Street-Meatz (TypeScript → JavaScript).
 */
import { firebaseConfig, auth } from '../firebase';

async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const user = auth?.currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (e) {
    console.warn('[REST] Failed to get auth token, proceeding without auth:', e);
  }
  return headers;
}

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') return { timestampValue: value.toDate().toISOString() };
    if ('seconds' in value && 'nanoseconds' in value && Object.keys(value).length === 2) {
      const ms = value.seconds * 1000 + Math.floor(value.nanoseconds / 1000000);
      return { timestampValue: new Date(ms).toISOString() };
    }
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function toFirestoreFields(data) {
  const fields = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}

function fromFirestoreValue(field) {
  if ('nullValue' in field) return null;
  if ('booleanValue' in field) return field.booleanValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return field.doubleValue;
  if ('stringValue' in field) return field.stringValue;
  if ('timestampValue' in field) return field.timestampValue;
  if ('geoPointValue' in field) return field.geoPointValue;
  if ('referenceValue' in field) return field.referenceValue;
  if ('bytesValue' in field) return field.bytesValue;
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in field) return fromFirestoreFields(field.mapValue.fields || {});
  return null;
}

function fromFirestoreFields(fields) {
  const result = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = fromFirestoreValue(value);
  }
  return result;
}

/**
 * Write (merge) fields to a Firestore document via REST API.
 * Equivalent to setDoc(doc(db, collection, docId), data, { merge: true })
 */
export async function restSetDoc(collectionPath, docId, data) {
  const { id: _id, ...cleanData } = data;
  const fieldPaths = Object.keys(cleanData);
  if (fieldPaths.length === 0) {
    console.warn(`[REST WRITE] No fields to write for ${collectionPath}/${docId}`);
    return;
  }
  const updateMask = fieldPaths.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `${BASE_URL}/${collectionPath}/${docId}?${updateMask}`;
  const body = JSON.stringify({ fields: toFirestoreFields(cleanData) });
  const headers = await getAuthHeaders();
  const res = await fetch(url, { method: 'PATCH', headers, body });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST write failed (${res.status}): ${errText}`);
  }
}

/**
 * Read a Firestore document via REST API.
 */
export async function restGetDoc(collectionPath, docId) {
  const url = `${BASE_URL}/${collectionPath}/${docId}`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST read failed (${res.status}): ${errText}`);
  }
  const docData = await res.json();
  if (!docData.fields) return {};
  return fromFirestoreFields(docData.fields);
}

/**
 * List all documents in a Firestore collection via REST API.
 */
export async function restListDocs(collectionPath, orderByField, direction) {
  let allDocs = [];
  let pageToken = '';
  const headers = await getAuthHeaders();
  do {
    let url = `${BASE_URL}/${collectionPath}?pageSize=300`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    if (orderByField) url += `&orderBy=${encodeURIComponent(orderByField)}${direction === 'DESCENDING' ? ' desc' : ''}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Firestore REST list failed (${res.status}): ${errText}`);
    }
    const data = await res.json();
    if (data.documents) {
      for (const doc of data.documents) {
        const docPath = doc.name;
        const id = docPath.split('/').pop() || '';
        const fields = doc.fields ? fromFirestoreFields(doc.fields) : {};
        allDocs.push({ ...fields, id });
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return allDocs;
}

/**
 * Delete a Firestore document via REST API.
 */
export async function restDeleteDoc(collectionPath, docId) {
  const url = `${BASE_URL}/${collectionPath}/${docId}`;
  const headers = await getAuthHeaders();
  const res = await fetch(url, { method: 'DELETE', headers });
  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    throw new Error(`Firestore REST delete failed (${res.status}): ${errText}`);
  }
}
