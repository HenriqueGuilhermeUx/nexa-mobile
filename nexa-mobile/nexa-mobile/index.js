import React, { useEffect, useState } from 'react';
import { Modal, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerRootComponent } from 'expo';

import App from './App';
import CustodyScreen from './CustodyScreen';

function NexaRoot() {
  const [session, setSession] = useState({ user: null, token: '' });
  const [custodyOpen, setCustodyOpen] = useState(false);

  async function refreshSession() {
    try {
      const [savedUser, savedToken] = await Promise.all([
        AsyncStorage.getItem('nexa_user'),
        AsyncStorage.getItem('nexa_token'),
      ]);

      setSession({
        user: savedUser ? JSON.parse(savedUser) : null,
        token: savedToken || '',
      });
    } catch (_) {
      setSession({ user: null, token: '' });
    }
  }

  useEffect(() => {
    refreshSession();
    const timer = setInterval(refreshSession, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <App />

      {session.user?.id ? (
        <TouchableOpacity
          onPress={() => setCustodyOpen(true)}
          style={{
            position: 'absolute',
            right: 16,
            bottom: 22,
            backgroundColor: '#2563eb',
            borderRadius: 24,
            paddingHorizontal: 17,
            paddingVertical: 13,
            elevation: 8,
            shadowColor: '#000',
            shadowOpacity: 0.28,
            shadowRadius: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '900' }}>Custódia</Text>
        </TouchableOpacity>
      ) : null}

      <Modal
        visible={custodyOpen}
        animationType="slide"
        onRequestClose={() => setCustodyOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
          <View style={{ flex: 1, padding: 18 }}>
            <CustodyScreen
              user={session.user}
              token={session.token}
              onBack={() => setCustodyOpen(false)}
              onBalanceRefresh={() => {}}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

registerRootComponent(NexaRoot);
