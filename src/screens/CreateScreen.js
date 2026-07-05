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
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth';
import * as api from '../api';
import { theme } from '../theme';

const KINDS = [
  { key: 'PHOTO', label: 'Photo', icon: 'image-outline' },
  { key: 'CAROUSEL', label: 'Carousel', icon: 'images-outline' },
  { key: 'REEL', label: 'Reel', icon: 'film-outline' },
  { key: 'STORY', label: 'Story', icon: 'ellipse-outline' },
];

const SUCCESS = {
  PHOTO: 'Your photo is now live on your Instagram.',
  CAROUSEL: 'Your carousel is now live on your Instagram.',
  REEL: 'Your reel is now live on your Instagram.',
  STORY: 'Your story is live for the next 24 hours.',
};

const NOTES = {
  PHOTO: 'JPEG only, served from a public URL. Camera-roll photos are uploaded to a public host first.',
  CAROUSEL: '2–10 photos/videos in one post. Items are cropped to the first item’s aspect ratio.',
  REEL: '9:16 MP4 recommended, 3–90s. The video is uploaded to a public host, then processed by Instagram (can take up to a minute).',
  STORY: 'Photo or video, 9:16. Interactive stickers (polls, music, links, questions) aren’t available through Instagram’s API — only the media itself is posted. Captions are ignored on stories.',
};

const isVideoUrl = (u) => /\.(mp4|mov|m4v|webm)(\?|$)/i.test(u);

export default function CreateScreen() {
  const { token, userId } = useAuth();
  const nav = useNavigation();
  const [kind, setKind] = useState('PHOTO');
  const [assets, setAssets] = useState([]); // [{ uri, isVideo, name }]
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [shareToFeed, setShareToFeed] = useState(true);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Not connected.{'\n'}Go to Settings and paste your token.</Text>
      </View>
    );
  }

  const switchKind = (k) => {
    setKind(k);
    setAssets([]);
    setUrl('');
    setStatus(null);
  };

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to pick media.');
      return;
    }
    const opts = {
      PHOTO: { mediaTypes: ['images'] },
      REEL: { mediaTypes: ['videos'], videoMaxDuration: 90 },
      STORY: { mediaTypes: ['images', 'videos'], videoMaxDuration: 60 },
      CAROUSEL: { mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 10 },
    }[kind];
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.9, ...opts });
    if (res.canceled) return;
    const mapped = res.assets.map((a) => ({ uri: a.uri, isVideo: a.type === 'video', name: a.fileName }));
    if (kind === 'CAROUSEL') setAssets(mapped.slice(0, 10));
    else {
      setAssets(mapped.slice(0, 1));
      setUrl('');
    }
  };

  const post = async () => {
    const onStatus = (s) => setStatus(s);
    try {
      setBusy(true);
      if (kind === 'CAROUSEL') {
        if (assets.length < 2) throw new Error('Pick at least 2 items for a carousel.');
        const items = [];
        for (let i = 0; i < assets.length; i++) {
          onStatus(`Uploading ${i + 1}/${assets.length}…`);
          const up = await api.uploadToCatbox(assets[i].uri, { name: assets[i].name, isVideo: assets[i].isVideo });
          items.push({ url: up, isVideo: assets[i].isVideo });
        }
        await api.createCarousel(token, userId, items, caption.trim(), { onStatus });
      } else {
        const a = assets[0];
        let mediaUrl = url.trim();
        let isVideo;
        if (a) {
          isVideo = a.isVideo;
          onStatus(isVideo ? 'Uploading video…' : 'Uploading photo…');
          mediaUrl = await api.uploadToCatbox(a.uri, { name: a.name, isVideo });
        } else if (mediaUrl) {
          isVideo = isVideoUrl(mediaUrl);
        } else {
          throw new Error('Pick media from your camera roll or paste a public URL.');
        }

        if (kind === 'PHOTO') {
          if (isVideo) throw new Error('Photo posts need an image — switch to Reel for video.');
          onStatus('Publishing…');
          await api.createPhotoPost(token, userId, mediaUrl, caption.trim());
        } else if (kind === 'REEL') {
          if (!isVideo) throw new Error('Reels need a video.');
          await api.createReel(token, userId, mediaUrl, caption.trim(), { shareToFeed, onStatus });
        } else if (kind === 'STORY') {
          await api.createStory(
            token,
            userId,
            isVideo ? { videoUrl: mediaUrl, onStatus } : { imageUrl: mediaUrl, onStatus }
          );
        }
      }

      setBusy(false);
      setStatus(null);
      setAssets([]);
      setUrl('');
      setCaption('');
      if (kind === 'STORY') {
        Alert.alert('Posted! 🎉', SUCCESS.STORY);
      } else {
        Alert.alert('Posted! 🎉', SUCCESS[kind], [
          { text: 'View my posts', onPress: () => nav.navigate('Posts', { refreshAt: Date.now() }) },
          { text: 'OK', style: 'cancel' },
        ]);
      }
    } catch (e) {
      setBusy(false);
      setStatus(null);
      Alert.alert('Could not post', e.message);
    }
  };

  const single = kind !== 'CAROUSEL';
  const urlPreviewIsVideo = url.trim() && isVideoUrl(url.trim());

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {/* Type selector */}
        <View style={styles.kindRow}>
          {KINDS.map((k) => {
            const active = k.key === kind;
            return (
              <TouchableOpacity
                key={k.key}
                style={[styles.kind, active && styles.kindActive]}
                onPress={() => switchKind(k.key)}
                activeOpacity={0.8}>
                <Ionicons name={k.icon} size={20} color={active ? '#fff' : theme.sub} />
                <Text style={[styles.kindTxt, active && { color: '#fff' }]}>{k.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Media picker area */}
        {kind === 'CAROUSEL' ? (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {assets.map((a, i) => (
                <View key={i} style={styles.carouselItem}>
                  {a.isVideo ? (
                    <View style={styles.videoTile}>
                      <Ionicons name="film-outline" size={26} color={theme.sub} />
                    </View>
                  ) : (
                    <Image source={{ uri: a.uri }} style={styles.carouselImg} />
                  )}
                </View>
              ))}
              <TouchableOpacity style={styles.addTile} onPress={pick} activeOpacity={0.8}>
                <Ionicons name="add" size={30} color={theme.sub} />
              </TouchableOpacity>
            </ScrollView>
            <Text style={styles.count}>{assets.length}/10 selected {assets.length < 2 ? '(need at least 2)' : ''}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.picker} onPress={pick} activeOpacity={0.8}>
            {assets[0] ? (
              assets[0].isVideo ? (
                <View style={styles.videoPreview}>
                  <Ionicons name="film-outline" size={40} color={theme.sub} />
                  <Text style={styles.muted}>{assets[0].name || 'Video selected'}</Text>
                </View>
              ) : (
                <Image source={{ uri: assets[0].uri }} style={styles.preview} resizeMode="cover" />
              )
            ) : url.trim() && !urlPreviewIsVideo ? (
              <Image source={{ uri: url.trim() }} style={styles.preview} resizeMode="cover" />
            ) : (
              <Text style={styles.pickTxt}>
                ＋  {kind === 'REEL' ? 'Pick a video' : kind === 'STORY' ? 'Pick a photo or video' : 'Pick a photo'} from camera roll
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* URL fallback for single-item kinds */}
        {single && (
          <>
            <Text style={styles.or}>— or paste a public {kind === 'REEL' ? 'video' : 'media'} URL —</Text>
            <TextInput
              style={styles.urlInput}
              value={url}
              onChangeText={(t) => {
                setUrl(t);
                setAssets([]);
              }}
              placeholder={kind === 'REEL' ? 'https://…/clip.mp4' : 'https://…/photo.jpg'}
              placeholderTextColor={theme.sub}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </>
        )}

        {/* Reel: share to feed */}
        {kind === 'REEL' && (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Also share to feed</Text>
            <Switch value={shareToFeed} onValueChange={setShareToFeed} trackColor={{ true: theme.accent }} />
          </View>
        )}

        {/* Caption (not for stories) */}
        {kind !== 'STORY' && (
          <TextInput
            style={styles.caption}
            value={caption}
            onChangeText={setCaption}
            placeholder="Write a caption…  #hashtags  @mentions"
            placeholderTextColor={theme.sub}
            multiline
          />
        )}

        <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={post} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnTxt}>
              {kind === 'STORY' ? 'Share to Story' : kind === 'REEL' ? 'Share Reel' : 'Share to Instagram'}
            </Text>
          )}
        </TouchableOpacity>
        {status ? <Text style={styles.status}>{status}</Text> : null}

        <Text style={styles.note}>{NOTES[kind]}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg, padding: 30 },
  muted: { color: theme.sub, textAlign: 'center', fontSize: 14, lineHeight: 22, marginTop: 6 },
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kind: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 3,
  },
  kindActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  kindTxt: { color: theme.sub, fontSize: 12, fontWeight: '600' },
  picker: {
    height: 280,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  preview: { width: '100%', height: '100%' },
  videoPreview: { alignItems: 'center', gap: 8 },
  pickTxt: { color: theme.sub, fontSize: 15, paddingHorizontal: 20, textAlign: 'center' },
  carouselItem: { marginRight: 8 },
  carouselImg: { width: 90, height: 90, borderRadius: 8, backgroundColor: theme.card },
  videoTile: {
    width: 90,
    height: 90,
    borderRadius: 8,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  addTile: {
    width: 90,
    height: 90,
    borderRadius: 8,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: 'dashed',
  },
  count: { color: theme.sub, fontSize: 12, marginBottom: 4 },
  or: { color: theme.sub, textAlign: 'center', marginVertical: 12, fontSize: 13 },
  urlInput: {
    color: theme.text,
    backgroundColor: theme.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  switchLabel: { color: theme.text, fontSize: 15 },
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
