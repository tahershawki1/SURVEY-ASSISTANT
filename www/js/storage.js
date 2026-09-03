/* تخزين محلي: الإعدادات + مركز الإشعارات + الدفتر الميداني + حالة الأدوات
   يعتمد على Preferences (Capacitor) إن وُجدت، وإلا localStorage كبديل للمعاينة في المتصفح. */

const Store = (() => {
  const KEY_SETTINGS = "masaha_settings";
  const KEY_NOTIFS = "masaha_notifications";
  const KEY_FIELDNOTES = "masaha_fieldnotes";
  const KEY_TOOL = (id) => `masaha_tool_${id}`;

  const MAX_NOTIFS = 100;
  const MAX_NOTES = 500;

  /* مصدر التحديثات مثبّت في الكود عمدًا: السماح بتغييره من الواجهة يعني السماح
     بتحميل حزمة واجهة من أي مصدر وتشغيلها داخل التطبيق. */
  const UPDATE_SOURCE = Object.freeze({
    githubOwner: "tahershawki1",
    githubRepo: "SURVEY-ASSISTANT",
    branch: "main",
  });

  const DEFAULT_SETTINGS = {
    autoCheck: true,
    checkIntervalHours: 6,
    currentVersion: "1.0.0",
    lastCheck: null,
    lastNotifiedOtaVersion: null,
    lastNotifiedNativeCode: null,
    levelTolerance: 0.005,
    levelToleranceProfile: "concrete",
    traverseMethod: "bowditch",
  };

  const MIN_INTERVAL_HOURS = 1;
  const MAX_INTERVAL_HOURS = 168;

  async function _get(key) {
    try {
      if (window.Native && window.Native.Preferences) {
        const { value } = await window.Native.Preferences.get({ key });
        return value ? JSON.parse(value) : null;
      }
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("storage read failed", key, e);
      return null;
    }
  }

  async function _set(key, val) {
    const raw = JSON.stringify(val);
    try {
      if (window.Native && window.Native.Preferences) {
        await window.Native.Preferences.set({ key, value: raw });
      } else {
        localStorage.setItem(key, raw);
      }
      return true;
    } catch (e) {
      console.warn("storage write failed", key, e);
      return false;
    }
  }

  async function _remove(key) {
    try {
      if (window.Native && window.Native.Preferences) await window.Native.Preferences.remove({ key });
      else localStorage.removeItem(key);
    } catch (e) { /* تجاهل */ }
  }

  /* ---------------- الإعدادات ---------------- */
  function sanitizeSettings(s) {
    const out = { ...DEFAULT_SETTINGS, ...(s || {}) };
    out.autoCheck = out.autoCheck !== false;
    let h = parseInt(out.checkIntervalHours, 10);
    if (!Number.isFinite(h) || h < MIN_INTERVAL_HOURS) h = MIN_INTERVAL_HOURS;
    if (h > MAX_INTERVAL_HOURS) h = MAX_INTERVAL_HOURS;
    out.checkIntervalHours = h;
    const tol = parseFloat(out.levelTolerance);
    out.levelTolerance = Number.isFinite(tol) && tol >= 0 && tol <= 1 ? tol : DEFAULT_SETTINGS.levelTolerance;
    if (out.traverseMethod !== "transit") out.traverseMethod = "bowditch";
    if (typeof out.currentVersion !== "string" || !/^\d+(\.\d+)*$/.test(out.currentVersion)) {
      out.currentVersion = DEFAULT_SETTINGS.currentVersion;
    }
    // مصدر التحديث غير قابل للتعديل من التخزين
    delete out.githubOwner; delete out.githubRepo; delete out.branch;
    return out;
  }

  async function getSettings() {
    return { ...sanitizeSettings(await _get(KEY_SETTINGS)), ...UPDATE_SOURCE };
  }

  async function saveSettings(patch) {
    const cur = await getSettings();
    const next = sanitizeSettings({ ...cur, ...patch });
    await _set(KEY_SETTINGS, next);
    return { ...next, ...UPDATE_SOURCE };
  }

  function manifestUrl() {
    const { githubOwner, githubRepo, branch } = UPDATE_SOURCE;
    return `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${branch}/updates/manifest.json`;
  }
  function nativeManifestUrl() {
    const { githubOwner, githubRepo, branch } = UPDATE_SOURCE;
    return `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${branch}/updates/native-manifest.json`;
  }

  /* ---------------- الإشعارات ---------------- */
  async function getNotifications() {
    const list = await _get(KEY_NOTIFS);
    return Array.isArray(list) ? list : [];
  }

  /* dedupeKey يمنع تكرار نفس الإشعار (مثل إشعار نفس إصدار التحديث) */
  async function addNotification({ icon = "🔔", title, message, dedupeKey = null }) {
    const list = await getNotifications();
    if (dedupeKey && list.some((n) => n.dedupeKey === dedupeKey)) return list;
    list.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      icon: String(icon).slice(0, 4),
      title: String(title || "").slice(0, 200),
      message: String(message || "").slice(0, 1000),
      dedupeKey,
      time: new Date().toISOString(),
      read: false,
    });
    const next = list.slice(0, MAX_NOTIFS);
    await _set(KEY_NOTIFS, next);
    return next;
  }

  async function markAllRead() {
    const list = await getNotifications();
    list.forEach((n) => (n.read = true));
    await _set(KEY_NOTIFS, list);
  }

  async function clearNotifications() { await _set(KEY_NOTIFS, []); }

  async function unreadCount() {
    return (await getNotifications()).filter((n) => !n.read).length;
  }

  /* ---------------- الدفتر الميداني ---------------- */
  async function getFieldNotes() {
    const list = await _get(KEY_FIELDNOTES);
    return Array.isArray(list) ? list : [];
  }

  async function addFieldNote(note) {
    const list = await getFieldNotes();
    list.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      time: new Date().toISOString(),
      ...note,
    });
    const next = list.slice(0, MAX_NOTES);
    await _set(KEY_FIELDNOTES, next);
    return next;
  }

  async function updateFieldNote(id, patch) {
    const list = await getFieldNotes();
    const i = list.findIndex((n) => n.id === id);
    if (i < 0) return list;
    list[i] = { ...list[i], ...patch, editedAt: new Date().toISOString() };
    await _set(KEY_FIELDNOTES, list);
    return list;
  }

  async function deleteFieldNote(id) {
    const next = (await getFieldNotes()).filter((n) => n.id !== id);
    await _set(KEY_FIELDNOTES, next);
    return next;
  }

  /* ---------------- حالة الأدوات (حفظ تلقائي) ---------------- */
  async function getToolState(toolId, fallback = null) {
    const v = await _get(KEY_TOOL(toolId));
    return v === null || v === undefined ? fallback : v;
  }

  async function setToolState(toolId, data) {
    return _set(KEY_TOOL(toolId), { ...data, savedAt: new Date().toISOString() });
  }

  async function clearToolState(toolId) { await _remove(KEY_TOOL(toolId)); }

  /* حفظ مؤجّل: يمنع الكتابة على كل ضغطة مفتاح */
  function autosaver(toolId, getData, delay = 400) {
    let t = null;
    let pending = false;
    const flush = async () => {
      if (t) { clearTimeout(t); t = null; }
      if (!pending) return;
      pending = false;
      await setToolState(toolId, getData());
    };
    const schedule = () => {
      pending = true;
      if (t) clearTimeout(t);
      t = setTimeout(flush, delay);
    };
    // نضمن الحفظ عند مغادرة الصفحة أو تحويل التطبيق للخلفية
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
    return { save: schedule, flush };
  }

  return {
    UPDATE_SOURCE, DEFAULT_SETTINGS, MIN_INTERVAL_HOURS, MAX_INTERVAL_HOURS, MAX_NOTES,
    getSettings, saveSettings, manifestUrl, nativeManifestUrl,
    getNotifications, addNotification, markAllRead, clearNotifications, unreadCount,
    getFieldNotes, addFieldNote, updateFieldNote, deleteFieldNote,
    getToolState, setToolState, clearToolState, autosaver,
  };
})();
