// store.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import defaultWeeklyPlan from './plan';

// Initial settings with athlete object and other expected defaults
const initialSettings = {
  units: 'imperial',
  athlete: { firstName: '', lastName: '', year: '', level: 'highschool' },
  planOverridden: false,
  watermarkUri: '',
};

// ---------- Attempt-video utilities ----------
const keyForAttempt = (sessionId, heightInches, attemptNumber) =>
  `${sessionId}::h=${Number(heightInches) || 0}::a=${Number(attemptNumber) || 0}`;

const newVideoItem = (uri, title = '') => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  uri,
  title: title || `Clip ${new Date().toLocaleString()}`,
  addedAt: Date.now(),
});

export const usePVStore = create(
  persist(
    (set, get) => ({
      // ---- State ----
      settings: initialSettings,
      sessions: [],
      weeklyPlan: defaultWeeklyPlan,

      // NEW: attempt-level videos bucket
      // Shape: { [attemptKey]: Array<{id, uri, title, addedAt}> }
      attemptVideos: {},

      // ---- Actions ----

      // Add a new session (you already pass a full session object with .id)
      addSession: (sess) =>
        set((state) => ({
          sessions: [sess, ...state.sessions], // newest first
        })),

      // Update session by ID
      updateSession: (id, updatedFields) =>
        set((state) => ({
          sessions: state.sessions.map((sess) =>
            sess.id === id ? { ...sess, ...updatedFields } : sess
          ),
        })),

      // Delete session by ID
      deleteSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((sess) => sess.id !== id),
        })),

      // Replace weekly plan
      setWeeklyPlan: (plan) =>
        set(() => ({
          weeklyPlan: plan,
          settings: { ...get().settings, planOverridden: true },
        })),

      // Reset to default plan
      resetWeeklyPlan: () =>
        set(() => ({
          weeklyPlan: defaultWeeklyPlan,
          settings: { ...get().settings, planOverridden: false },
        })),

      // Update settings wholesale
      setSettings: (settings) =>
        set(() => ({
          settings,
        })),

      // Update a single athlete field
      setAthleteField: (field, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            athlete: {
              ...state.settings.athlete,
              [field]: value,
            },
          },
        })),

      // Set units
      setUnits: (units) =>
        set((state) => ({
          settings: {
            ...state.settings,
            units,
          },
        })),

      // Set watermark uri
      setWatermarkUri: (uri) =>
        set((state) => ({
          settings: {
            ...state.settings,
            watermarkUri: uri,
          },
        })),

      // ---------- Attempt-level video helpers ----------
      // Read all clips for a specific (session, height, attempt)
      getAttemptVideos(sessionId, heightInches, attemptNumber) {
        const k = keyForAttempt(sessionId, heightInches, attemptNumber);
        return get().attemptVideos[k] || [];
      },

      // Add a clip
      addAttemptVideo(sessionId, heightInches, attemptNumber, uri, title) {
        const k = keyForAttempt(sessionId, heightInches, attemptNumber);
        set((state) => {
          const list = state.attemptVideos[k] || [];
          return {
            attemptVideos: {
              ...state.attemptVideos,
              [k]: [newVideoItem(uri, title), ...list],
            },
          };
        });
      },

      // Rename a clip
      renameAttemptVideo(sessionId, heightInches, attemptNumber, videoId, newTitle) {
        const k = keyForAttempt(sessionId, heightInches, attemptNumber);
        set((state) => {
          const list = state.attemptVideos[k] || [];
          return {
            attemptVideos: {
              ...state.attemptVideos,
              [k]: list.map((v) => (v.id === videoId ? { ...v, title: newTitle } : v)),
            },
          };
        });
      },

      // Delete a clip
      deleteAttemptVideo(sessionId, heightInches, attemptNumber, videoId) {
        const k = keyForAttempt(sessionId, heightInches, attemptNumber);
        set((state) => {
          const list = state.attemptVideos[k] || [];
          return {
            attemptVideos: {
              ...state.attemptVideos,
              [k]: list.filter((v) => v.id !== videoId),
            },
          };
        });
      },
    }),
    {
      name: 'polevault-tracker-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 14, // bump from your 13 to include attemptVideos
      migrate: async (persisted) => {
        // Ensure new keys exist
        try {
          const out = { ...persisted };
          if (!out.settings) out.settings = initialSettings;
          if (!out.sessions) out.sessions = [];
          // Fix: ensure weeklyPlan is always the static plan if missing or empty/invalid
          if (
            !out.weeklyPlan ||
            typeof out.weeklyPlan !== 'object' ||
            Object.keys(out.weeklyPlan).length !== 7 // Must have all 7 days
          ) {
            out.weeklyPlan = defaultWeeklyPlan;
          }
          if (!out.attemptVideos) out.attemptVideos = {};
          return out;
        } catch {
          return persisted;
        }
      },
      // Persist only relevant keys
      partialize: (state) => ({
        settings: state.settings,
        sessions: state.sessions,
        weeklyPlan: state.weeklyPlan,
        attemptVideos: state.attemptVideos,
      }),
    }
  )
);