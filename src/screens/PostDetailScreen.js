import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Dimensions,
} from 'react-native';
import { useAuth } from '../auth';
import * as api from '../api';
import { theme } from '../theme';

const W = Dimensions.get('window').width;

export default function PostDetailScreen({ route }) {
  const { media } = route.params;
  const { token } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { id, username }
  const [sending, setSending] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getComments(token, media.id);
      setComments(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, media.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    try {
      setSending(true);
      if (replyTo) await api.replyToComment(token, replyTo.id, body);
      else await api.commentOnMedia(token, media.id, body);
      setText('');
      setReplyTo(null);
      await loadComments();
    } catch (e) {
      Alert.alert('Could not post', e.message);
    } finally {
      setSending(false);
    }
  };

  const onHide = async (c) => {
    try {
      await api.hideComment(token, c.id, !c.hidden);
      await loadComments();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const onDelete = (c) => {
    Alert.alert('Delete comment?', c.text, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteComment(token, c.id);
            await loadComments();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const images =
    media.media_type === 'CAROUSEL_ALBUM' && media.children?.data?.length
      ? media.children.data.map((c) =>
          c.media_type === 'VIDEO' ? c.thumbnail_url || c.media_url : c.media_url
        )
      : [media.media_type === 'VIDEO' ? media.thumbnail_url || media.media_url : media.media_url];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <FlatList
          horizontal
          pagingEnabled
          data={images}
          keyExtractor={(u, i) => String(i)}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => <Image source={{ uri: item }} style={styles.media} resizeMode="cover" />}
        />
        {images.length > 1 ? <Text style={styles.carousel}>{images.length} items — swipe ›</Text> : null}

        <View style={styles.meta}>
          <Text style={styles.stat}>
            ♥ {media.like_count ?? '–'}    💬 {media.comments_count ?? comments.length}
          </Text>
          <TouchableOpacity onPress={() => media.permalink && Linking.openURL(media.permalink)}>
            <Text style={styles.link}>Open in Instagram ↗</Text>
          </TouchableOpacity>
        </View>

        {media.caption ? <Text style={styles.caption}>{media.caption}</Text> : null}

        <View style={styles.divider} />
        <Text style={styles.section}>Comments</Text>
        {loading ? <ActivityIndicator color={theme.text} style={{ margin: 20 }} /> : null}
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {!loading && comments.length === 0 ? <Text style={styles.muted}>No comments yet.</Text> : null}

        {comments.map((c) => (
          <Comment
            key={c.id}
            c={c}
            onReply={() => setReplyTo({ id: c.id, username: c.username || 'user' })}
            onHide={() => onHide(c)}
            onDelete={() => onDelete(c)}
          />
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={styles.composer}>
        {replyTo ? (
          <View style={styles.replyBar}>
            <Text style={styles.replyTxt}>Replying to @{replyTo.username}</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Text style={styles.replyX}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
            placeholderTextColor={theme.sub}
            style={styles.input}
            multiline
          />
          <TouchableOpacity onPress={send} disabled={sending || !text.trim()}>
            <Text style={[styles.postBtn, { opacity: sending || !text.trim() ? 0.4 : 1 }]}>
              {sending ? '…' : 'Post'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Comment({ c, onReply, onHide, onDelete }) {
  const replies = c.replies?.data || [];
  return (
    <View style={styles.comment}>
      <Text style={[styles.cText, c.hidden && { opacity: 0.4 }]}>
        <Text style={styles.cUser}>{c.username || 'user'} </Text>
        {c.text}
        {c.hidden ? '  · hidden' : ''}
      </Text>
      <View style={styles.actions}>
        <Action label="Reply" onPress={onReply} />
        <Action label={c.hidden ? 'Unhide' : 'Hide'} onPress={onHide} />
        <Action label="Delete" onPress={onDelete} danger />
      </View>
      {replies.map((r) => (
        <View key={r.id} style={styles.reply}>
          <Text style={styles.cText}>
            <Text style={styles.cUser}>{r.username || 'user'} </Text>
            {r.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Action({ label, onPress, danger }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={8}>
      <Text style={[styles.action, danger && { color: theme.danger }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  media: { width: W, height: W, backgroundColor: theme.card },
  carousel: { color: theme.sub, fontSize: 12, textAlign: 'center', paddingTop: 6 },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  stat: { color: theme.text, fontSize: 15, fontWeight: '600' },
  link: { color: theme.accent, fontSize: 14, fontWeight: '600' },
  caption: { color: theme.text, fontSize: 14, lineHeight: 20, paddingHorizontal: 14, paddingTop: 10 },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 14 },
  section: { color: theme.text, fontSize: 16, fontWeight: '700', paddingHorizontal: 14, paddingBottom: 6 },
  muted: { color: theme.sub, paddingHorizontal: 14, paddingVertical: 8 },
  err: { color: theme.danger, paddingHorizontal: 14, paddingVertical: 8 },
  comment: { paddingHorizontal: 14, paddingVertical: 8 },
  cText: { color: theme.text, fontSize: 14, lineHeight: 20 },
  cUser: { fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 18, marginTop: 5 },
  action: { color: theme.sub, fontSize: 13, fontWeight: '600' },
  reply: { paddingLeft: 24, paddingTop: 8 },
  composer: { borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.bg },
  replyBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: theme.card,
  },
  replyTxt: { color: theme.sub, fontSize: 13 },
  replyX: { color: theme.sub, fontSize: 14, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, gap: 10 },
  input: {
    flex: 1,
    color: theme.text,
    fontSize: 15,
    maxHeight: 120,
    backgroundColor: theme.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  postBtn: { color: theme.accent, fontSize: 15, fontWeight: '700', paddingBottom: 10 },
});
