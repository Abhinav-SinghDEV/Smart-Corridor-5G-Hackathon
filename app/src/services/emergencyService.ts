import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ServiceType } from '../constants/emergency';

export interface EmergencyReport {
  id: string;
  service: ServiceType;
  emergencyClass: string;
  emergencyLabel: string;
  priority: 1 | 2 | 3;
  sceneNode: string;
  sceneName: string;
  note: string;
  photoUri?: string;
  createdAt: string;
  status: 'pending' | 'dispatched' | 'on_scene' | 'completed';
  assignedUnit?: string;
  etaSeconds?: number;
}

const STORAGE_KEY = '@packmen_citizen_reports';

export async function getReports(): Promise<EmergencyReport[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const localReports: EmergencyReport[] = raw ? JSON.parse(raw) : [];

    // Optional background sync with backend for dispatched status
    try {
      const backendHost = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${backendHost}/api/citizen-reports`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const remoteReports: any[] = await res.json();
        const remoteMap = new Map(remoteReports.map((r) => [r.id, r]));
        let hasChanges = false;
        const updated = localReports.map((r) => {
          const remote = remoteMap.get(r.id);
          if (remote && remote.status !== r.status) {
            hasChanges = true;
            return {
              ...r,
              status: remote.status,
              assignedUnit: remote.status === 'dispatched' ? (r.service === 'fire' ? 'Fire Squad FT-1' : 'EMS Unit AMB-1') : undefined,
            };
          }
          return r;
        });
        if (hasChanges) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        }
      }
    } catch {
      // Return local cache on network timeout/offline
    }

    return localReports;
  } catch {
    return [];
  }
}

export async function saveReport(report: EmergencyReport): Promise<void> {
  try {
    const existing = await getReports();
    const updated = [report, ...existing.filter((r) => r.id !== report.id)];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save report:', err);
  }
}

export async function submitEmergency(data: {
  service: ServiceType;
  emergencyClass: string;
  emergencyLabel: string;
  priority: 1 | 2 | 3;
  sceneNode: string;
  sceneName: string;
  note: string;
  photoUri?: string;
}): Promise<EmergencyReport> {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const reportId = `EMG-${randomSuffix}`;

  const report: EmergencyReport = {
    id: reportId,
    service: data.service,
    emergencyClass: data.emergencyClass,
    emergencyLabel: data.emergencyLabel,
    priority: data.priority,
    sceneNode: data.sceneNode,
    sceneName: data.sceneName,
    note: data.note,
    photoUri: data.photoUri,
    createdAt: new Date().toISOString(),
    status: 'pending',
    etaSeconds: data.priority === 1 ? 180 : data.priority === 2 ? 300 : 480,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const backendHost = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
    await fetch(`${backendHost}/api/citizen-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        id: reportId,
        service: data.service,
        emergencyClass: data.emergencyClass,
        emergencyLabel: data.emergencyLabel,
        priority: data.priority,
        sceneNode: data.sceneNode,
        sceneName: data.sceneName,
        note: data.note,
        photoData: data.photoUri || null,
      }),
    }).catch(() => {});
    clearTimeout(timeout);
  } catch {
    // Graceful offline fallback
  }

  await saveReport(report);
  return report;
}
