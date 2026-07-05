import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useAuth } from '../auth';
import { theme } from '../theme';

const PRO_TYPES = ['BUSINESS', 'CREATOR', 'MEDIA_CREATOR'];

export default function SettingsScreen() {
  const { token, username, accountType, userId, expiresAt, connect, refresh, disconnect } = useAuth();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const onConnect = async () => {
    if (!input.trim()) return;
    try {
      setBusy(true);
      const me = await connect(input.trim());
      setInput('');
      if (me.account_type && !PRO_TYPES.includes(me.account_type)) {
        Alert.alert(
          'Connected — but note',
          `Your account type is ${me.account_type}. Reading posts/comments and publishing require a Business or Creator account. Convert in the Instagram app under Settings → Account type and tools.`
        );
      } else {
        Alert.alert('Connected ✓', `Signed in as @${me.username}`);
      }
    } catch (e) {
      Alert.alert(
        'Connection failed',
        e.message +
          '\n\nMake sure this is a valid long-lived Instagram token (from graph.instagram.com), not a Facebook token.'
      );
    } finally {
      setBusy(false);
    }
  };

  const onRefresh = async () => {
    try {
      setBusy(true);
      const r = await refresh();
      Alert.alert('Token refreshed ✓', `Valid for ~${Math.round(r.expires_in / 86400)} more days.`);
    } catch (e) {
      Alert.alert('Refresh failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = () => {
    Alert.alert('Disconnect?', 'This removes the stored token from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: disconnect },
    ]);
  };

  const expDate = expiresAt ? new Date(Number(expiresAt)).toLocaleDateString() : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16 }}>
      {token ? (
        <View style={styles.card}>
          <Text style={styles.connected}>Connected ✓</Text>
          <Row k="Account" v={username ? '@' + username : '—'} />
          <Row k="Type" v={accountType || '—'} />
          <Row k="User ID" v={userId || '—'} />
          {expDate ? <Row k="Token est. expiry" v={expDate} /> : null}
          <TouchableOpacity style={styles.btn} onPress={onRefresh} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Refresh token (extend 60 days)</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.danger]} onPress={onDisconnect}>
            <Text style={styles.btnTxt}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.h}>Connect your Instagram</Text>
          <Text style={styles.help}>
            Paste a long-lived access token from your Meta app (graph.instagram.com). Setup steps are below.
          </Text>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="IGAA…  (paste access token)"
            placeholderTextColor={theme.sub}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
          />
          <TouchableOpacity style={styles.btn} onPress={onConnect} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Connect</Text>}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.h}>How to get a token</Text>
        <Step n="1" t="Convert your Instagram to a Business or Creator account (IG app → Settings → Account type and tools)." />
        <Step n="2" t="At developers.facebook.com, create an app → add the product 'Instagram' → 'API setup with Instagram login'." />
        <Step n="3" t="Add your IG account as an app tester and accept the invite. Keep the app in Development mode — no App Review is needed to act on your own account." />
        <Step n="4" t="Generate a user token with scopes: instagram_business_basic, instagram_business_manage_comments, instagram_business_content_publish." />
        <Step n="5" t="Exchange it for a 60-day long-lived token, then paste it above. Tap 'Refresh token' here before it expires to extend another 60 days." />
        <TouchableOpacity
          onPress={() =>
            Linking.openURL(
              'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login'
            )
          }>
          <Text style={styles.link}>Open Meta setup docs ↗</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>
        This app only ever touches your own account — your posts and the comments on them. It never fetches anyone
        else's content.
      </Text>
    </ScrollView>
  );
}

function Row({ k, v }) {
  return (
    <Text style={styles.row}>
      {k}: <Text style={styles.val}>{v}</Text>
    </Text>
  );
}

function Step({ n, t }) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepN}>{n}</Text>
      <Text style={styles.stepT}>{t}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  connected: { color: '#4caf50', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  h: { color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  help: { color: theme.sub, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  row: { color: theme.sub, fontSize: 14, marginBottom: 6 },
  val: { color: theme.text, fontWeight: '600' },
  input: {
    color: theme.text,
    backgroundColor: theme.card2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  btn: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  danger: { backgroundColor: theme.danger },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  step: { flexDirection: 'row', marginBottom: 12, gap: 10 },
  stepN: {
    color: '#fff',
    backgroundColor: theme.accent,
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
  },
  stepT: { color: theme.text, fontSize: 13, lineHeight: 19, flex: 1 },
  link: { color: theme.accent, fontSize: 14, fontWeight: '600', marginTop: 8 },
  footer: { color: theme.sub, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 10, paddingBottom: 30 },
});
