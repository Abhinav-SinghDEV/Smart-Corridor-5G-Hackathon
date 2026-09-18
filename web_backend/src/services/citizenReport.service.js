'use strict';

const { db } = require('../db/connection');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { now } = require('../utils/helpers');

function toPublic(row) {
  if (!row) return null;
  let parsedMl = null;
  if (row.ml_assessment) {
    try {
      parsedMl = JSON.parse(row.ml_assessment);
    } catch {
      parsedMl = null;
    }
  }

  return {
    id: row.id,
    service: row.service,
    emergencyClass: row.emergency_class,
    emergencyLabel: row.emergency_label,
    priority: row.priority,
    sceneNode: row.scene_node,
    sceneName: row.scene_name,
    note: row.note || '',
    photoData: row.photo_data || null,
    mlAssessment: parsedMl,
    status: row.status,
    dispatchedAt: row.dispatched_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findById(id) {
  return toPublic(db.prepare('SELECT * FROM citizen_reports WHERE id = ?').get(id));
}

function getByIdOrFail(id) {
  const report = findById(id);
  if (!report) throw ApiError.notFound('Citizen report not found');
  return report;
}

function list({ status, limit = 50 } = {}) {
  let query = 'SELECT * FROM citizen_reports';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Math.min(limit, 100));

  const rows = db.prepare(query).all(...params);
  return rows.map(toPublic);
}

async function runMlInference(payload) {
  if (!payload.photoData) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${config.mlBackendUrl}/infer/incident`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        imageBase64: payload.photoData,
        service: payload.service,
        emergencyClass: payload.emergencyClass,
        emergencyLabel: payload.emergencyLabel,
        reportedPriority: payload.priority,
        sceneNode: payload.sceneNode,
      }),
    });
    clearTimeout(timer);

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Non-blocking fallback if ML backend is busy or offline
  }
  return null;
}

function normalizeNodeId(nodeId) {
  if (!nodeId) return 'J0001';
  const str = String(nodeId).trim();
  const match = str.match(/^J?0*(\d+)$/i);
  if (match) {
    return `J${match[1].padStart(4, '0')}`;
  }
  return str;
}

async function create(payload) {
  const id = payload.id || `CIT-${Math.floor(1000 + Math.random() * 9000)}`;
  const timestamp = now();
  const priority = Number(payload.priority) || 2;
  const service = payload.service === 'fire' ? 'fire' : 'medical';
  const sceneNode = normalizeNodeId(payload.sceneNode);

  const mlAssessment = await runMlInference({ ...payload, sceneNode });

  db.prepare(
    `INSERT INTO citizen_reports (
      id, service, emergency_class, emergency_label, priority,
      scene_node, scene_name, note, photo_data, ml_assessment, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  ).run(
    id,
    service,
    payload.emergencyClass || 'general_emergency',
    payload.emergencyLabel || 'Emergency Call',
    priority,
    sceneNode,
    payload.sceneName || sceneNode || 'Unknown Location',
    payload.note || '',
    payload.photoData || null,
    mlAssessment ? JSON.stringify(mlAssessment) : null,
    timestamp,
    timestamp,
  );

  return findById(id);
}

function markDispatched(id) {
  const existing = getByIdOrFail(id);
  const timestamp = now();

  db.prepare(
    `UPDATE citizen_reports
     SET status = 'dispatched', dispatched_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(timestamp, timestamp, id);

  return findById(id);
}

function markCancelled(id) {
  const existing = getByIdOrFail(id);
  const timestamp = now();

  db.prepare(
    `UPDATE citizen_reports
     SET status = 'cancelled', updated_at = ?
     WHERE id = ?`,
  ).run(timestamp, id);

  return findById(id);
}

module.exports = {
  toPublic,
  findById,
  getByIdOrFail,
  list,
  create,
  markDispatched,
  markCancelled,
};
