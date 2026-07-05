import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth';
import * as api from '../api';
import { theme } from '../theme';

const COLS = 3;
const GAP = 2;
const SIZE = (Dimensions.get('window').width - GAP * (COLS - 1)) / COLS;

function thumb(m) {
  if (m.media_type === 'VIDEO') return m.thumbnail_url || m.media_url;
  if (m.media_type === 'CAROUSEL_ALBUM') {
    const c = m.children?.data?.[0];
    if (c) return c.media_type === 'VIDEO' ? c.thumbnail_url || c.media_url : c.media_url;
  }
  return m.media_url;
}

export default function PostsScreen() {
  const { token, username } = useAuth();
  const nav = useNavigation();
  const [media, setMedia] = useState([]);
  const [after, setAfter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (reset) => {
      if (!token) return;
      try {
        setError(null);
        reset ? setRefreshing(true) : setLoading(true);
        const res = await api.getMedia(token, reset ? null : after);
        const items = res.data || [];
        setMedia((prev) => (reset ? items : [...prev, ...items]));
        setAfter(res.paging?.next ? res.paging?.cursors?.after : null);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, after]
  );

  useFocusEffect(
    useCallback(() => {
      if (token && media.length === 0) load(true);
    }, [token]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!token) {
    return <Empty text="Not connected.\n\nGo to the Settings tab and paste your Instagram access token to see your posts." />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <FlatList
        data={media}
        keyExtractor={(m) => m.id}
        numColumns={COLS}
        refreshControl={
          <RefreshControl tintColor={theme.text} refreshing={refreshing} onRefresh={() => load(true)} />
        }
        onEndReached={() => after && load(false)}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          username ? (
            <Text style={styles.header}>@{username}</Text>
          ) : null
        }
        ListEmptyComponent={!loading && !refreshing ? <Empty text="No posts found on your account yet." /> : null}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => nav.navigate('PostDetail', { media: item })}
            style={{
              width: SIZE,
              height: SIZE,
              marginRight: index % COLS === COLS - 1 ? 0 : GAP,
              marginBottom: GAP,
            }}>
            <Image source={{ uri: thumb(item) }} style={styles.cell} />
            {item.media_type !== 'IMAGE' ? (
              <Text style={styles.badge}>{item.media_type === 'VIDEO' ? '▶' : '❏'}</Text>
            ) : null}
          </TouchableOpacity>
        )}
      />
      {loading ? (
        <ActivityIndicator style={styles.spinner} color={theme.text} />
      ) : null}
    </View>
  );
}

function Empty({ text }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTxt}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { color: theme.text, fontSize: 20, fontWeight: '700', padding: 12 },
  cell: { width: '100%', height: '100%', backgroundColor: theme.card },
  badge: {
    position: 'absolute',
    top: 5,
    right: 7,
    color: '#fff',
    fontSize: 14,
    textShadowColor: '#000',
    textShadowRadius: 4,
  },
  empty: { flex: 1, padding: 40, paddingTop: 120, alignItems: 'center' },
  emptyTxt: { color: theme.sub, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  err: { color: theme.danger, padding: 12, textAlign: 'center' },
  spinner: { position: 'absolute', bottom: 24, alignSelf: 'center' },
});
