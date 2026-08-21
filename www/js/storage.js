/* تخزين محلي بسيط: الإعدادات + مركز الإشعارات
   يعتمد على Preferences (Capacitor) إن وُجدت، وإلا يستخدم localStorage كبديل للمعاينة داخل المتصفح */

const Store = (() => {
  const KEY_SETTINGS = "masaha_settings";
  const KEY_NOTIFS = "masaha_notifications";
  const KEY_FIELDNOTES = "masaha_fieldnotes";

  const DEFAULT_SETTINGS = {
    githubOwner: "tahershawki1",
    githubRepo: "SURVEY-ASSISTANT",
    branch: "main",
    autoCheck: true,
    checkIntervalHours: 6,
    currentVersion: "1.0.0",
    lastCheck: null,
  };

  async function _get(key) {
    if (window.Native && window.Native.Preferences) {
      const { value } = await window.Native.Preferences.get({ key });
      return value ? JSON.parse(value) : null;
    }
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }

  async function _set(key, val) {
    const raw = JSON.stringify(val);
    if (window.Native && window.Native.Preferences) {
      await window.Native.Preferences.set({ key, value: raw });
    } else {
      localStorage.setItem(key, raw);
    }
  }

  async function getSettings() {
    const s = await _get(KEY_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...(s || {}) };
  }

  async function saveSettings(patch) {
    const cur = await getSettings();
    const next = { ...cur, ...patch };
    await _set(KEY_SETTINGS, next);
    return next;
  }

  async function manifestUrl() {
    const s = await getSettings();
    return `https://raw.githubusercontent.com/${s.githubOwner}/${s.githubRepo}/${s.branch}/updates/manifest.json`;
  }

  async function getNotifications() {
    const list = await _get(KEY_NOTIFS);
    return list || [];
  }

  async function addNotification({ icon = "🔔", title, message }) {
    const list = await getNotifications();
    list.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      icon,
      title,
      message,
      time: new Date().toISOString(),
      read: false,
    });
    await _set(KEY_NOTIFS, list.slice(0, 100));
    return list;
  }

  async function markAllRead() {
    const list = await getNotifications();
    list.forEach((n) => (n.read = true));
    await _set(KEY_NOTIFS, list);
  }

  async function clearNotifications() {
    await _set(KEY_NOTIFS, []);
  }

  async function unreadCount() {
    const list = await getNotifications();
    return list.filter((n) => !n.read).length;
  }

  async function getFieldNotes() {
    const list = await _get(KEY_FIELDNOTES);
    return list || [];
  }

  async function addFieldNote(note) {
    const list = await getFieldNotes();
    list.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      time: new Date().toISOString(),
      ...note,
    });
    await _set(KEY_FIELDNOTES, list);
    return list;
  }

  async function deleteFieldNote(id) {
    const list = await getFieldNotes();
    const next = list.filter((n) => n.id !== id);
    await _set(KEY_FIELDNOTES, next);
    return next;
  }

  return {
    getSettings,
    saveSettings,
    manifestUrl,
    getNotifications,
    addNotification,
    markAllRead,
    clearNotifications,
    unreadCount,
    getFieldNotes,
    addFieldNote,
    deleteFieldNote,
  };
})();
