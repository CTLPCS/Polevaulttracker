import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  FlatList,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePVStore } from './store';


export default function VideoScreen() {
  // ---- Attempt-level videos from global store ----
  const attemptVideos = usePVStore((s) => s.attemptVideos);

  // Flatten all attempt videos into one array for display, including key info for each video
  const allAttemptVideos = useMemo(() =>
    Object.entries(attemptVideos)
      .flatMap(([key, arr]) => {
        // Parse key: `${sessionId}::h=${heightInches}::a=${attemptNumber}`
        const [sessionId, h, a] = key.split("::");
        const heightInches = Number(h.split('=')[1]);
        const attemptNumber = Number(a.split('=')[1]);
        return (arr || []).map(video => ({
          ...video,
          sessionId,
          heightInches,
          attemptNumber,
        }));
      })
      .sort((a, b) => b.addedAt - a.addedAt)
  , [attemptVideos]);

  // Camera/record/upload state
  const [showCamera, setShowCamera] = useState(false);
  const [recordedUri, setRecordedUri] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  // Rename modal state
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameVideo, setRenameVideo] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  // Camera + mic permissions
  const cameraRef = useRef(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();

  // Store actions for attempt-level videos
  const addAttemptVideo = usePVStore((s) => s.addAttemptVideo);
  const renameAttemptVideo = usePVStore((s) => s.renameAttemptVideo);
  const deleteAttemptVideo = usePVStore((s) => s.deleteAttemptVideo);

  // Navigation (for "View in Log")
  const navigation = useNavigation();

  // Ask for permissions on camera modal open
  useEffect(() => {
    (async () => {
      if (!showCamera) return;
      try {
        if (!camPerm?.granted) await requestCamPerm();
        if (!micPerm?.granted) await requestMicPerm();
      } catch {
        /* no-op */
      }
    })();
  }, [showCamera]);

  // Player for preview-after-record
  const previewPlayer = useVideoPlayer(null, (player) => {
    player.loop = false;
  });

  // Load freshly recorded clip into preview player
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!recordedUri) return;
      try {
        await previewPlayer.replaceAsync(recordedUri);
        if (cancelled) return;
      } catch {
        /* no-op */
      }
    })();
    return () => { cancelled = true; };
  }, [recordedUri, previewPlayer]);

  // Open camera modal (ensure permissions first)
  async function onPressRecordVideo() {
    if (!camPerm?.granted) {
      const res = await requestCamPerm();
      if (!res?.granted) {
        Alert.alert('Permission required', 'Camera access is required to record video.');
        return;
      }
    }
    if (!micPerm?.granted) {
      const resMic = await requestMicPerm();
      if (!resMic?.granted) {
        Alert.alert('Permission required', 'Microphone access is required to record video with audio.');
        return;
      }
    }
    setRecordedUri(null);
    setShowCamera(true);
  }

  // Start/Stop recording toggle
  async function onToggleRecord() {
    if (!cameraRef.current) return;

    if (!isRecording) {
      setIsRecording(true);
      try {
        const result = await cameraRef.current.recordAsync(); // resolves on stopRecording()
        if (result?.uri) setRecordedUri(result.uri);
      } catch (e) {
        Alert.alert('Error', `Could not record video:\n${e?.message || e}`);
      } finally {
        setIsRecording(false);
      }
    } else {
      try {
        cameraRef.current.stopRecording();
      } catch {
        /* no-op */
      }
    }
  }

  // Save recorded video to the global attemptVideos store (not local state)
  function onSaveRecorded() {
    if (!recordedUri) return;
    // Use a dummy sessionId, height, attempt for general videos
    addAttemptVideo("general", 0, 0, recordedUri, `Recorded ${new Date().toLocaleString()}`);
    setShowCamera(false);
    setRecordedUri(null);
  }

  // Upload existing from library
  async function onPickFromLibrary() {
  try {
    // Work with both new and old expo-image-picker APIs
    const hasNewEnum = ImagePicker?.MediaType && typeof ImagePicker.MediaType.VIDEO !== 'undefined';

    const result = await ImagePicker.launchImageLibraryAsync({
      // Use ARRAY form (new API), fall back to legacy enum if needed
      mediaTypes: hasNewEnum
        ? [ImagePicker.MediaType.VIDEO]                       // new API (SDK 17+)
        : ImagePicker?.MediaTypeOptions?.Videos ?? undefined, // legacy fallback
      allowsEditing: false,
      quality: 1,
    });

    if (!result?.canceled) {
      // Support both result shapes
      const uri =
        result.assets?.[0]?.uri ??
        result.uri ??
        null;

      if (uri) {
        addAttemptVideo("general", 0, 0, uri, `Uploaded ${new Date().toLocaleString()}`);
      }
    }
  } catch (e) {
    Alert.alert('Picker Error', e?.message || String(e));
  }
}

  // Share a video URI
  async function onShareVideo(video) {
    try {
      await Share.share(
        Platform.select({
          ios: { url: video.uri, message: undefined, title: video.title },
          android: { message: `${video.title}\n${video.uri}` },
          default: { message: `${video.title}\n${video.uri}` },
        })
      );
    } catch (e) {
      Alert.alert('Share Error', e?.message || String(e));
    }
  }

  // Begin rename (uses keys)
  function beginRename(video) {
    setRenameVideo(video);
    setRenameValue(video.title || '');
    setRenameVisible(true);
  }
  function cancelRename() {
    setRenameVisible(false);
    setRenameVideo(null);
    setRenameValue('');
  }
  function confirmRename() {
    if (!renameVideo) return;
    renameAttemptVideo(
      renameVideo.sessionId,
      renameVideo.heightInches,
      renameVideo.attemptNumber,
      renameVideo.id,
      renameValue.trim() || 'Untitled video'
    );
    setRenameVisible(false);
    setRenameVideo(null);
    setRenameValue('');
  }

  // "View in Log" handler
  function onGoToSession(video) {
    // Only run for non-general videos
    if (video.sessionId !== "general") {
      navigation.navigate('SessionDetails', {
        id: video.sessionId,
        heightInches: video.heightInches,
        attemptNumber: video.attemptNumber,
      });
    }
  }

  // Friendly label row
  function renderVideo({ item }) {
    return (
      <VideoRow
        video={item}
        onGoToSession={onGoToSession}
        onDelete={() => onDeleteVideo(item)}
        onShare={() => onShareVideo(item)}
        onRename={() => beginRename(item)}
      />
    );
  }

  const needPermSheet =
    showCamera &&
    ((!camPerm || camPerm.status !== 'granted') || (!micPerm || micPerm.status !== 'granted'));

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Videos</Text>

      <View style={styles.buttonRow}>
        <Button title="Upload Video" onPress={onPickFromLibrary} />
        <Button title="Record Video" onPress={onPressRecordVideo} />
      </View>

      {/* Camera / Preview Modal */}
      <Modal visible={showCamera} animationType="slide" onRequestClose={() => setShowCamera(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {needPermSheet ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', marginBottom: 16 }}>
                Camera and microphone permission are required.
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ marginRight: 12 }}>
                  <Button title="Allow Camera" onPress={requestCamPerm} />
                </View>
                <Button title="Allow Microphone" onPress={requestMicPerm} />
              </View>
              <View style={{ marginTop: 16 }}>
                <Button title="Close" onPress={() => setShowCamera(false)} />
              </View>
            </View>
          ) : recordedUri ? (
            // Playback preview after recording
            <View style={{ flex: 1 }}>
              <VideoView
                style={{ flex: 1 }}
                player={previewPlayer}
                nativeControls
                allowsPictureInPicture
                contentFit="contain"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 24 }}>
                <Button title="Save" onPress={onSaveRecorded} />
                <Button title="Discard" onPress={() => setRecordedUri(null)} />
                <Button title="Close" onPress={() => setShowCamera(false)} />
              </View>
            </View>
          ) : (
            // Live camera
            <View style={{ flex: 1 }}>
              <CameraView
                ref={cameraRef}
                style={{ flex: 1 }}
                facing="back"
                mode="video"
                enableAudio
              />
              <View style={{ position: 'absolute', bottom: 32, width: '100%', alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={onToggleRecord}
                  style={[
                    styles.recBtn,
                    isRecording && { backgroundColor: '#ef4444', borderColor: '#ef4444' },
                  ]}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                    {isRecording ? 'Stop' : 'Record'}
                  </Text>
                </TouchableOpacity>
                <View style={{ marginTop: 12 }}>
                  <Button title="Close" onPress={() => setShowCamera(false)} />
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Rename Modal */}
      <Modal visible={renameVisible} transparent animationType="fade" onRequestClose={cancelRename}>
        <View style={styles.renameOverlay}>
          <View style={styles.renameCard}>
            <Text style={styles.renameTitle}>Rename video</Text>
            <TextInput
              style={styles.renameInput}
              placeholder="Enter a title"
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity onPress={cancelRename} style={[styles.smallBtn, { marginRight: 8 }]}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmRename} style={[styles.smallBtn, styles.smallBtnPrimary]}>
                <Text style={{ color: '#fff' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        data={allAttemptVideos}
        keyExtractor={(item) => item.id}
        renderItem={renderVideo}
        contentContainerStyle={{ paddingBottom: 48 }}
        ListEmptyComponent={<Text style={styles.infoText}>No videos yet. Record or upload one.</Text>}
      />
    </View>
  );
}

/** Row with friendly title + player + actions + overflow menu (⋮) */
function VideoRow({ video, onGoToSession, onDelete, onShare, onRename }) {
  const rowPlayer = useVideoPlayer(video.uri, (player) => {
    player.loop = false;
  });
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.videoBlock}>
      <View style={styles.rowHeader}>
        <Text style={styles.metaLabel}>{video.title}</Text>
        <TouchableOpacity onPress={() => setMenuOpen((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuDots}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Overflow menu */}
      {menuOpen && (
        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuOpen(false); onRename(); }}>
            <Text>Rename</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuOpen(false); onShare(); }}>
            <Text>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuOpen(false); onDelete(); }}>
            <Text style={{ color: '#ef4444' }}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      <VideoView
        style={{ height: 220, width: '100%', backgroundColor: '#000' }}
        player={rowPlayer}
        nativeControls
        allowsPictureInPicture
        contentFit="contain"
      />

      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {video.sessionId !== "general" && (
          <TouchableOpacity style={styles.attachBtn} onPress={() => onGoToSession(video)}>
            <Text>View in Log</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 48, marginBottom: 16 },
  heading: { fontWeight: 'bold', fontSize: 22, marginBottom: 8, marginTop: 48 },

  videoBlock: { marginVertical: 12, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 12 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  metaLabel: { fontSize: 12, color: '#666', marginRight: 12 },
  menuDots: { fontSize: 20, color: '#444', paddingHorizontal: 4 },

  menuCard: {
    position: 'absolute',
    top: 36,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 6,
    minWidth: 140,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 10,
  },
  menuItem: { paddingVertical: 10, paddingHorizontal: 14 },

  attachBtn: { backgroundColor: '#e0e7ff', padding: 8, borderRadius: 6, marginRight: 8 },
  deleteBtn: { backgroundColor: '#ef4444', padding: 8, borderRadius: 6 },

  infoText: { marginTop: 32, color: '#888', fontSize: 14 },

  recBtn: {
    height: 64,
    minWidth: 140,
    borderRadius: 999,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Rename modal
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  renameCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  renameTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  renameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  smallBtnPrimary: {
    backgroundColor: '#2563eb',
  },
});