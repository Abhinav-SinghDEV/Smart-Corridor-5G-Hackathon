import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  Linking,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { getReports, EmergencyReport } from '../services/emergencyService';
import { PRIORITY_CONFIG } from '../constants/emergency';

const STATUS_CONFIG = {
  pending: { label: 'Awaiting Dispatch', bg: '#FEF3C7', color: '#B45309', dot: '#F59E0B' },
  dispatched: { label: 'Unit En Route', bg: '#DBEAFE', color: '#1D4ED8', dot: '#3B82F6' },
  on_scene: { label: 'Active On Scene', bg: '#EDE9FE', color: '#6D28D9', dot: '#8B5CF6' },
  completed: { label: 'Resolved', bg: '#DCFCE7', color: '#15803D', dot: '#22C55E' },
} as const;

export default function ReportsScreen() {
  const [reports, setReports] = useState<EmergencyReport[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await getReports();
    setReports(list);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const callHelpline = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dispatch History</Text>
        <TouchableOpacity onPress={() => router.push('/')} style={styles.newReportBtn} activeOpacity={0.8}>
          <Text style={styles.newReportBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Emergency Hotline Bar */}
      <View style={styles.hotlinesStrip}>
        <Text style={styles.hotlineTitle}>Hotlines:</Text>
        <TouchableOpacity onPress={() => callHelpline('112')} style={styles.hotlineChip} activeOpacity={0.7}>
          <Text style={styles.hotlineChipText}>📞 112 (All SOS)</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => callHelpline('108')} style={styles.hotlineChip} activeOpacity={0.7}>
          <Text style={styles.hotlineChipText}>🚑 108 EMS</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => callHelpline('101')} style={styles.hotlineChip} activeOpacity={0.7}>
          <Text style={styles.hotlineChipText}>🚒 101 Fire</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Text style={styles.emptyIcon}>📋</Text>
            </View>
            <Text style={styles.emptyTitle}>No Emergency Calls Recorded</Text>
            <Text style={styles.emptySub}>
              Reports submitted via this terminal will appear here with live response tracking, corridor status, and unit assignment.
            </Text>
            <TouchableOpacity style={styles.reportNowBtn} onPress={() => router.push('/')} activeOpacity={0.85}>
              <Text style={styles.reportNowBtnText}>Submit Emergency Call</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const priorityInfo = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG[2];
          const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
          const isMedical = item.service === 'medical';
          const timeString = new Date(item.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.idBadge}>
                  <Text style={styles.idText}>{item.id}</Text>
                  <Text style={styles.timeText}>· {timeString}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusInfo.dot }]} />
                  <Text style={[styles.statusText, { color: statusInfo.color }]}>
                    {statusInfo.label}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.serviceBadgeRow}>
                  <Text style={styles.serviceEmoji}>{isMedical ? '🚑' : '🚒'}</Text>
                  <Text style={styles.emergencyTitle}>{item.emergencyLabel}</Text>
                  <View style={[styles.priorityTag, { backgroundColor: priorityInfo.bg }]}>
                    <Text style={[styles.priorityTagText, { color: priorityInfo.color }]}>
                      P{item.priority}
                    </Text>
                  </View>
                </View>

                <View style={styles.locationRow}>
                  <Text style={styles.locationIcon}>📍</Text>
                  <Text style={styles.locationText} numberOfLines={1}>
                    {item.sceneName}
                  </Text>
                </View>

                {item.assignedUnit ? (
                  <View style={styles.assignedUnitRow}>
                    <View style={styles.assignedUnitDot} />
                    <Text style={styles.assignedUnitText}>Assigned: {item.assignedUnit}</Text>
                  </View>
                ) : null}

                {item.note ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesText} numberOfLines={2}>
                      "{item.note}"
                    </Text>
                  </View>
                ) : null}

                {item.photoUri ? (
                  <View style={styles.photoContainer}>
                    <Image source={{ uri: item.photoUri }} style={styles.photoThumbnail} resizeMode="cover" />
                    <View style={styles.photoTag}>
                      <Text style={styles.photoTagText}>Attached Photo · AI Classified</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 10,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },
  newReportBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  newReportBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  hotlinesStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  hotlineTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  hotlineChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hotlineChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  reportNowBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  reportNowBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  idText: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '800',
    color: '#0F172A',
  },
  timeText: {
    fontSize: 11,
    color: '#64748B',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  cardBody: {
    padding: 14,
  },
  serviceBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceEmoji: {
    fontSize: 20,
  },
  emergencyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  priorityTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityTagText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 5,
  },
  locationIcon: {
    fontSize: 13,
  },
  locationText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    flex: 1,
  },
  assignedUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 5,
  },
  assignedUnitDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  assignedUnitText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  notesBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  notesText: {
    fontSize: 11.5,
    color: '#64748B',
    fontStyle: 'italic',
  },
  photoContainer: {
    marginTop: 10,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  photoTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photoTagText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
  },
});
