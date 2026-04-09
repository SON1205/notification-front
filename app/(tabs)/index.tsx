import { useEffect } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View, AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { notificationApi } from '@/services/api/notificationApi';
import { useNotificationStore } from '@/store/notificationStore';
import { connectSSE, disconnect } from '@/services/sse/sseClient';
import type { Notification } from '@/types/notification';

export default function NotificationsScreen() {
  const { notifications, setNotifications, addNotification, markAsRead } =
    useNotificationStore();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationApi.getAll,
  });

  // data 변경 시 스토어 동기화
  useEffect(() => {
    if (data) {
      setNotifications(data);
    }
  }, [data]);

  // SSE 연결: foreground에서만 유지
  useEffect(() => {
    connectSSE(addNotification);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        connectSSE(addNotification);
        refetch();
      } else {
        disconnect();
      }
    });

    return () => {
      disconnect();
      subscription.remove();
    };
  }, []);

  const handlePress = async (item: Notification) => {
    if (!item.isRead) {
      markAsRead(item.id);
      await notificationApi.markAsRead(item.id).catch(() => {});
    }
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.item, !item.isRead && styles.unread]}
      onPress={() => handlePress(item)}>
      <View style={styles.header}>
        <Text style={styles.type}>{item.type}</Text>
        {!item.isRead && <View style={styles.dot} />}
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.content} numberOfLines={2}>{item.content}</Text>
      <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>알림이 없습니다</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  unread: { backgroundColor: '#f0f7ff' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  type: { fontSize: 12, color: '#666' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#007AFF', marginLeft: 6 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  content: { fontSize: 14, color: '#333', marginBottom: 4 },
  time: { fontSize: 12, color: '#999' },
  empty: { fontSize: 16, color: '#999' },
});
