import { StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';

import { useAuthStore } from '@/store/authStore';
import { registerForPushNotifications } from '@/services/push/pushService';

export default function SettingsScreen() {
  const logout = useAuthStore((s) => s.logout);

  const handlePushRegister = async () => {
    const token = await registerForPushNotifications();
    if (token) {
      Alert.alert('푸시 등록 완료', `토큰: ${token.slice(0, 20)}...`);
    } else {
      Alert.alert('푸시 등록 실패', '기기에서만 가능합니다');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handlePushRegister}>
        <Text style={styles.buttonText}>푸시 알림 등록</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={logout}>
        <Text style={[styles.buttonText, styles.logoutText]}>로그아웃</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  button: {
    padding: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  logoutButton: { backgroundColor: '#ff3b30' },
  logoutText: { color: '#fff' },
});
