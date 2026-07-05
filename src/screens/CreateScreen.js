import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth';
import * as api from '../api';
import { theme } from '../theme';

export default function CreateScreen() {
  const { token, userId } = useAuth();
  const nav = useNavigation();
  const [caption, setCaption] = useState('');
  const [localUri, setLocalUri] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Not connected.{'\n'}Go to Settings and paste your token.</Text>
      </View>
    );
  }

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to pick an image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!res.canceled) {
      setLocalUri(res.assets[0].uri);
      setImageUrl('');
    }
  };

  const post = async () => {
    if (!localUri && !imageUrl.trim()) {
      Alert.alert('Pick an image', 'Choose a photo from your camera roll or paste a public image URL.');
      return;
    }
    try {
      setBusy(true);
      let url = imageUrl.trim();
      if (localUri) {
        setStatus('Uploading photo…');
        url = await api.uploadToCatbox(localUri);
      }
      setStatus('Publishing to Instagram…');
      await api.createPhotoPost(token, userId, url, caption.trim());
      setStatus(null);
      setBusy(false);
      setCaption('');
      setLocalUri(null);
      setImageUrl('');
      Alert.alert('Posted! 🎉', 'Your photo is now live on your Instagram.', [
        { text: 'View my posts', onPress: () => nav.navigate('Posts', { refreshAt: Date.now() }) },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (e) {
      setBusy(false);
      setStatus(null);
      Alert.alert('Could not post', e.message);
    }
  };

  const previewUri = localUri || (imageUrl.trim() ? imageUrl.trim() : null);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.h}>New Post</Text>

        <TouchableOpacity style={styles.picker} onPress={pick} activeOpacity={0.8}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
          ) : (
            <Text style={styles.pickTxt}>＋  Pick a photo from camera roll</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.or}>— or paste a public image URL —</Text>
        <TextInput
          style={styles.urlInput}
          value={imageUrl}
          onChangeText={(t) => {
            setImageUrl(t);
            setLocalUri(null);
          }}
          placeholder="https://…/photo.jpg"
          placeholderTextColor={theme.sub}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.caption}
          value={caption}
          onChangeText={setCaption}
          placeholder="Write a caption…  #hashtags  @mentions"
          placeholderTextColor={theme.sub}
          multiline
        />

        <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={post} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Share to Instagram</Text>}
        </TouchableOpacity>
        {status ? <Text style={styles.status}>{status}</Text> : null}

        <Text style={styles.note}>
          Instagram's API accepts JPEG images served from a public URL. Camera-roll photos are uploaded to a
          public host (catbox.moe) first, then published. Video/Reels posting isn't included in this build.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg, padding: 30 },
  muted: { color: theme.sub, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  h: { color: theme.text, fontSize: 22, fontWeight: '700', marginBottom: 14 },
  picker: {
    height: 260,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  preview: { width: '100%', height: '100%' },
  pickTxt: { color: theme.sub, fontSize: 16 },
  or: { color: theme.sub, textAlign: 'center', marginVertical: 12, fontSize: 13 },
  urlInput: {
    color: theme.text,
    backgroundColor: theme.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  caption: {
    color: theme.text,
    backgroundColor: theme.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 90,
    textAlignVertical: 'top',
    marginTop: 12,
  },
  btn: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  status: { color: theme.sub, textAlign: 'center', marginTop: 10 },
  note: { color: theme.sub, fontSize: 12, lineHeight: 18, marginTop: 18 },
});
