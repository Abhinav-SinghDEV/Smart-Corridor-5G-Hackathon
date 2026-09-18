import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { API_URL } from '../lib/config';
import useWorldStore from '../store/useWorldStore';
import useUIStore from '../store/useUIStore';
import { createMission } from '../engine/missions';

import useConnectionStore from '../store/useConnectionStore';
import sim from '../lib/simClient';

const knownIds = new Set();

export async function markCitizenReportDispatched(reportId) {
  try {
    await fetch(`${API_URL}/api/citizen-reports/${encodeURIComponent(reportId)}/dispatch`, {
      method: 'PATCH',
    });
  } catch {
    // Non-blocking fallback
  }
}

export async function markCitizenReportCancelled(reportId) {
  try {
    await fetch(`${API_URL}/api/citizen-reports/${encodeURIComponent(reportId)}/cancel`, {
      method: 'PATCH',
    });
  } catch {
    // Non-blocking fallback
  }
}

export function useCitizenReportsSync() {
  const isPollingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        const res = await fetch(`${API_URL}/api/citizen-reports?status=pending`);
        if (!res.ok) return;
        const reports = await res.json();
        if (cancelled || !Array.isArray(reports)) return;

        const currentMissions = useWorldStore.getState().missions;

        for (const report of reports) {
          const alreadyExists =
            knownIds.has(report.id) ||
            currentMissions.some((m) => m.id === report.id || m.citizenReportId === report.id);

          if (!alreadyExists) {
            knownIds.add(report.id);

            const mission = createMission({
              id: report.id,
              service: report.service,
              emergencyClass: report.emergencyClass,
              emergencyLabel: report.emergencyLabel,
              priority: report.priority,
              sceneNode: report.sceneNode,
              note: report.note,
              photoUri: report.photoData,
              mlAssessment: report.mlAssessment,
              isCitizenReport: true,
              citizenReportId: report.id,
            });

            if (useConnectionStore.getState().source === 'server') {
              sim.missions.create({
                id: report.id,
                service: report.service,
                emergencyClass: report.emergencyClass,
                sceneNode: report.sceneNode,
                priority: report.priority,
                note: report.note,
                emergencyLabel: report.emergencyLabel,
              }).catch(() => {});
            }

            const mlTag = report.mlAssessment?.mlVerified
              ? ` • 🤖 AI Verified: ${report.mlAssessment.hazardLabel} (${report.mlAssessment.hazardConfidence}%)`
              : '';

            toast.error(`🚨 Citizen Emergency Reported!`, {
              description: `${report.emergencyLabel} at ${report.sceneName || report.sceneNode} (P${report.priority})${mlTag}`,
              duration: 8000,
              action: {
                label: 'Inspect',
                onClick: () => {
                  useUIStore.getState().setSelectedMissionId(mission.id);
                },
              },
            });
          }
        }
      } catch {
        // Backend not reachable, ignore
      } finally {
        isPollingRef.current = false;
      }
    }

    // Initial poll
    poll();

    // Regular interval
    const interval = setInterval(poll, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
}
