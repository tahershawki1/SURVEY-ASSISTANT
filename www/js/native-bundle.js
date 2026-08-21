(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // node_modules/@capacitor/core/dist/index.js
  var ExceptionCode, CapacitorException, getPlatformId, createCapacitor, initCapacitorGlobal, Capacitor, registerPlugin, WebPlugin, encode, decode, CapacitorCookiesPluginWeb, CapacitorCookies, readBlobAsBase64, normalizeHttpHeaders, buildUrlParams, buildRequestInit, CapacitorHttpPluginWeb, CapacitorHttp, SystemBarsStyle, SystemBarType, SystemBarsPluginWeb, SystemBars;
  var init_dist = __esm({
    "node_modules/@capacitor/core/dist/index.js"() {
      (function(ExceptionCode2) {
        ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
        ExceptionCode2["Unavailable"] = "UNAVAILABLE";
      })(ExceptionCode || (ExceptionCode = {}));
      CapacitorException = class extends Error {
        constructor(message, code, data) {
          super(message);
          this.message = message;
          this.code = code;
          this.data = data;
        }
      };
      getPlatformId = (win) => {
        var _a, _b;
        if (win === null || win === void 0 ? void 0 : win.androidBridge) {
          return "android";
        } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
          return "ios";
        } else {
          return "web";
        }
      };
      createCapacitor = (win) => {
        const capCustomPlatform = win.CapacitorCustomPlatform || null;
        const cap = win.Capacitor || {};
        const Plugins = cap.Plugins = cap.Plugins || {};
        const getPlatform = () => {
          return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
        };
        const isNativePlatform = () => getPlatform() !== "web";
        const isPluginAvailable = (pluginName) => {
          const plugin = registeredPlugins.get(pluginName);
          if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
            return true;
          }
          if (getPluginHeader(pluginName)) {
            return true;
          }
          return false;
        };
        const getPluginHeader = (pluginName) => {
          var _a;
          return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
        };
        const handleError = (err) => win.console.error(err);
        const registeredPlugins = /* @__PURE__ */ new Map();
        const registerPlugin2 = (pluginName, jsImplementations = {}) => {
          const registeredPlugin = registeredPlugins.get(pluginName);
          if (registeredPlugin) {
            console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
            return registeredPlugin.proxy;
          }
          const platform = getPlatform();
          const pluginHeader = getPluginHeader(pluginName);
          let jsImplementation;
          const loadPluginImplementation = async () => {
            if (!jsImplementation && platform in jsImplementations) {
              jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
            } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
              jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
            }
            return jsImplementation;
          };
          const createPluginMethod = (impl, prop) => {
            var _a, _b;
            if (pluginHeader) {
              const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
              if (methodHeader) {
                if (methodHeader.rtype === "promise") {
                  return (options) => cap.nativePromise(pluginName, prop.toString(), options);
                } else {
                  return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
                }
              } else if (impl) {
                return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
              }
            } else if (impl) {
              return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
            } else {
              throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
            }
          };
          const createPluginMethodWrapper = (prop) => {
            let remove;
            const wrapper = (...args) => {
              const p = loadPluginImplementation().then((impl) => {
                const fn = createPluginMethod(impl, prop);
                if (fn) {
                  const p2 = fn(...args);
                  remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                  return p2;
                } else {
                  throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
                }
              });
              if (prop === "addListener") {
                p.remove = async () => remove();
              }
              return p;
            };
            wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
            Object.defineProperty(wrapper, "name", {
              value: prop,
              writable: false,
              configurable: false
            });
            return wrapper;
          };
          const addListener = createPluginMethodWrapper("addListener");
          const removeListener = createPluginMethodWrapper("removeListener");
          const addListenerNative = (eventName, callback) => {
            const call = addListener({ eventName }, callback);
            const remove = async () => {
              const callbackId = await call;
              removeListener({
                eventName,
                callbackId
              }, callback);
            };
            const p = new Promise((resolve2) => call.then(() => resolve2({ remove })));
            p.remove = async () => {
              console.warn(`Using addListener() without 'await' is deprecated.`);
              await remove();
            };
            return p;
          };
          const proxy = new Proxy({}, {
            get(_, prop) {
              switch (prop) {
                // https://github.com/facebook/react/issues/20030
                case "$$typeof":
                  return void 0;
                case "toJSON":
                  return () => ({});
                case "addListener":
                  return pluginHeader ? addListenerNative : addListener;
                case "removeListener":
                  return removeListener;
                default:
                  return createPluginMethodWrapper(prop);
              }
            }
          });
          Plugins[pluginName] = proxy;
          registeredPlugins.set(pluginName, {
            name: pluginName,
            proxy,
            platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
          });
          return proxy;
        };
        if (!cap.convertFileSrc) {
          cap.convertFileSrc = (filePath) => filePath;
        }
        cap.getPlatform = getPlatform;
        cap.handleError = handleError;
        cap.isNativePlatform = isNativePlatform;
        cap.isPluginAvailable = isPluginAvailable;
        cap.registerPlugin = registerPlugin2;
        cap.Exception = CapacitorException;
        cap.DEBUG = !!cap.DEBUG;
        cap.isLoggingEnabled = !!cap.isLoggingEnabled;
        return cap;
      };
      initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
      Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
      registerPlugin = Capacitor.registerPlugin;
      WebPlugin = class {
        constructor() {
          this.listeners = {};
          this.retainedEventArguments = {};
          this.windowListeners = {};
        }
        addListener(eventName, listenerFunc) {
          let firstListener = false;
          const listeners = this.listeners[eventName];
          if (!listeners) {
            this.listeners[eventName] = [];
            firstListener = true;
          }
          this.listeners[eventName].push(listenerFunc);
          const windowListener = this.windowListeners[eventName];
          if (windowListener && !windowListener.registered) {
            this.addWindowListener(windowListener);
          }
          if (firstListener) {
            this.sendRetainedArgumentsForEvent(eventName);
          }
          const remove = async () => this.removeListener(eventName, listenerFunc);
          const p = Promise.resolve({ remove });
          return p;
        }
        async removeAllListeners() {
          this.listeners = {};
          for (const listener in this.windowListeners) {
            this.removeWindowListener(this.windowListeners[listener]);
          }
          this.windowListeners = {};
        }
        notifyListeners(eventName, data, retainUntilConsumed) {
          const listeners = this.listeners[eventName];
          if (!listeners) {
            if (retainUntilConsumed) {
              let args = this.retainedEventArguments[eventName];
              if (!args) {
                args = [];
              }
              args.push(data);
              this.retainedEventArguments[eventName] = args;
            }
            return;
          }
          listeners.forEach((listener) => listener(data));
        }
        hasListeners(eventName) {
          var _a;
          return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
        }
        registerWindowListener(windowEventName, pluginEventName) {
          this.windowListeners[pluginEventName] = {
            registered: false,
            windowEventName,
            pluginEventName,
            handler: (event) => {
              this.notifyListeners(pluginEventName, event);
            }
          };
        }
        unimplemented(msg = "not implemented") {
          return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
        }
        unavailable(msg = "not available") {
          return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
        }
        async removeListener(eventName, listenerFunc) {
          const listeners = this.listeners[eventName];
          if (!listeners) {
            return;
          }
          const index = listeners.indexOf(listenerFunc);
          this.listeners[eventName].splice(index, 1);
          if (!this.listeners[eventName].length) {
            this.removeWindowListener(this.windowListeners[eventName]);
          }
        }
        addWindowListener(handle) {
          window.addEventListener(handle.windowEventName, handle.handler);
          handle.registered = true;
        }
        removeWindowListener(handle) {
          if (!handle) {
            return;
          }
          window.removeEventListener(handle.windowEventName, handle.handler);
          handle.registered = false;
        }
        sendRetainedArgumentsForEvent(eventName) {
          const args = this.retainedEventArguments[eventName];
          if (!args) {
            return;
          }
          delete this.retainedEventArguments[eventName];
          args.forEach((arg) => {
            this.notifyListeners(eventName, arg);
          });
        }
      };
      encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
      decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
      CapacitorCookiesPluginWeb = class extends WebPlugin {
        async getCookies() {
          const cookies = document.cookie;
          const cookieMap = {};
          cookies.split(";").forEach((cookie) => {
            if (cookie.length <= 0)
              return;
            let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
            key = decode(key).trim();
            value = decode(value).trim();
            cookieMap[key] = value;
          });
          return cookieMap;
        }
        async setCookie(options) {
          try {
            const encodedKey = encode(options.key);
            const encodedValue = encode(options.value);
            const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
            const path = (options.path || "/").replace("path=", "");
            const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
            document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async deleteCookie(options) {
          try {
            document.cookie = `${options.key}=; Max-Age=0`;
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async clearCookies() {
          try {
            const cookies = document.cookie.split(";") || [];
            for (const cookie of cookies) {
              document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
            }
          } catch (error) {
            return Promise.reject(error);
          }
        }
        async clearAllCookies() {
          try {
            await this.clearCookies();
          } catch (error) {
            return Promise.reject(error);
          }
        }
      };
      CapacitorCookies = registerPlugin("CapacitorCookies", {
        web: () => new CapacitorCookiesPluginWeb()
      });
      readBlobAsBase64 = async (blob) => new Promise((resolve2, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result;
          resolve2(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(blob);
      });
      normalizeHttpHeaders = (headers = {}) => {
        const originalKeys = Object.keys(headers);
        const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
        const normalized = loweredKeys.reduce((acc, key, index) => {
          acc[key] = headers[originalKeys[index]];
          return acc;
        }, {});
        return normalized;
      };
      buildUrlParams = (params, shouldEncode = true) => {
        if (!params)
          return null;
        const output = Object.entries(params).reduce((accumulator, entry) => {
          const [key, value] = entry;
          let encodedValue;
          let item;
          if (Array.isArray(value)) {
            item = "";
            value.forEach((str) => {
              encodedValue = shouldEncode ? encodeURIComponent(str) : str;
              item += `${key}=${encodedValue}&`;
            });
            item.slice(0, -1);
          } else {
            encodedValue = shouldEncode ? encodeURIComponent(value) : value;
            item = `${key}=${encodedValue}`;
          }
          return `${accumulator}&${item}`;
        }, "");
        return output.substr(1);
      };
      buildRequestInit = (options, extra = {}) => {
        const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
        const headers = normalizeHttpHeaders(options.headers);
        const type = headers["content-type"] || "";
        if (typeof options.data === "string") {
          output.body = options.data;
        } else if (type.includes("application/x-www-form-urlencoded")) {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(options.data || {})) {
            params.set(key, value);
          }
          output.body = params.toString();
        } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
          const form = new FormData();
          if (options.data instanceof FormData) {
            options.data.forEach((value, key) => {
              form.append(key, value);
            });
          } else {
            for (const key of Object.keys(options.data)) {
              form.append(key, options.data[key]);
            }
          }
          output.body = form;
          const headers2 = new Headers(output.headers);
          headers2.delete("content-type");
          output.headers = headers2;
        } else if (type.includes("application/json") || typeof options.data === "object") {
          output.body = JSON.stringify(options.data);
        }
        return output;
      };
      CapacitorHttpPluginWeb = class extends WebPlugin {
        /**
         * Perform an Http request given a set of options
         * @param options Options to build the HTTP request
         */
        async request(options) {
          const requestInit = buildRequestInit(options, options.webFetchExtra);
          const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
          const url = urlParams ? `${options.url}?${urlParams}` : options.url;
          const response = await fetch(url, requestInit);
          const contentType = response.headers.get("content-type") || "";
          let { responseType = "text" } = response.ok ? options : {};
          if (contentType.includes("application/json")) {
            responseType = "json";
          }
          let data;
          let blob;
          switch (responseType) {
            case "arraybuffer":
            case "blob":
              blob = await response.blob();
              data = await readBlobAsBase64(blob);
              break;
            case "json":
              data = await response.json();
              break;
            case "document":
            case "text":
            default:
              data = await response.text();
          }
          const headers = {};
          response.headers.forEach((value, key) => {
            headers[key] = value;
          });
          return {
            data,
            headers,
            status: response.status,
            url: response.url
          };
        }
        /**
         * Perform an Http GET request given a set of options
         * @param options Options to build the HTTP request
         */
        async get(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
        }
        /**
         * Perform an Http POST request given a set of options
         * @param options Options to build the HTTP request
         */
        async post(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
        }
        /**
         * Perform an Http PUT request given a set of options
         * @param options Options to build the HTTP request
         */
        async put(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
        }
        /**
         * Perform an Http PATCH request given a set of options
         * @param options Options to build the HTTP request
         */
        async patch(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
        }
        /**
         * Perform an Http DELETE request given a set of options
         * @param options Options to build the HTTP request
         */
        async delete(options) {
          return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
        }
      };
      CapacitorHttp = registerPlugin("CapacitorHttp", {
        web: () => new CapacitorHttpPluginWeb()
      });
      (function(SystemBarsStyle2) {
        SystemBarsStyle2["Dark"] = "DARK";
        SystemBarsStyle2["Light"] = "LIGHT";
        SystemBarsStyle2["Default"] = "DEFAULT";
      })(SystemBarsStyle || (SystemBarsStyle = {}));
      (function(SystemBarType2) {
        SystemBarType2["StatusBar"] = "StatusBar";
        SystemBarType2["NavigationBar"] = "NavigationBar";
      })(SystemBarType || (SystemBarType = {}));
      SystemBarsPluginWeb = class extends WebPlugin {
        async setStyle() {
          this.unavailable("not available for web");
        }
        async setAnimation() {
          this.unavailable("not available for web");
        }
        async show() {
          this.unavailable("not available for web");
        }
        async hide() {
          this.unavailable("not available for web");
        }
      };
      SystemBars = registerPlugin("SystemBars", {
        web: () => new SystemBarsPluginWeb()
      });
    }
  });

  // node_modules/@capacitor/preferences/dist/esm/web.js
  var web_exports = {};
  __export(web_exports, {
    PreferencesWeb: () => PreferencesWeb
  });
  var PreferencesWeb;
  var init_web = __esm({
    "node_modules/@capacitor/preferences/dist/esm/web.js"() {
      init_dist();
      PreferencesWeb = class extends WebPlugin {
        constructor() {
          super(...arguments);
          this.group = "CapacitorStorage";
        }
        async configure({ group }) {
          if (typeof group === "string") {
            this.group = group;
          }
        }
        async get(options) {
          const value = this.impl.getItem(this.applyPrefix(options.key));
          return { value };
        }
        async set(options) {
          this.impl.setItem(this.applyPrefix(options.key), options.value);
        }
        async remove(options) {
          this.impl.removeItem(this.applyPrefix(options.key));
        }
        async keys() {
          const keys = this.rawKeys().map((k) => k.substring(this.prefix.length));
          return { keys };
        }
        async clear() {
          for (const key of this.rawKeys()) {
            this.impl.removeItem(key);
          }
        }
        async migrate() {
          var _a;
          const migrated = [];
          const existing = [];
          const oldprefix = "_cap_";
          const keys = Object.keys(this.impl).filter((k) => k.indexOf(oldprefix) === 0);
          for (const oldkey of keys) {
            const key = oldkey.substring(oldprefix.length);
            const value = (_a = this.impl.getItem(oldkey)) !== null && _a !== void 0 ? _a : "";
            const { value: currentValue } = await this.get({ key });
            if (typeof currentValue === "string") {
              existing.push(key);
            } else {
              await this.set({ key, value });
              migrated.push(key);
            }
          }
          return { migrated, existing };
        }
        async removeOld() {
          const oldprefix = "_cap_";
          const keys = Object.keys(this.impl).filter((k) => k.indexOf(oldprefix) === 0);
          for (const oldkey of keys) {
            this.impl.removeItem(oldkey);
          }
        }
        get impl() {
          return window.localStorage;
        }
        get prefix() {
          return this.group === "NativeStorage" ? "" : `${this.group}.`;
        }
        rawKeys() {
          return Object.keys(this.impl).filter((k) => k.indexOf(this.prefix) === 0);
        }
        applyPrefix(key) {
          return this.prefix + key;
        }
      };
    }
  });

  // node_modules/@capacitor/local-notifications/dist/esm/web.js
  var web_exports2 = {};
  __export(web_exports2, {
    LocalNotificationsWeb: () => LocalNotificationsWeb
  });
  var LocalNotificationsWeb;
  var init_web2 = __esm({
    "node_modules/@capacitor/local-notifications/dist/esm/web.js"() {
      init_dist();
      LocalNotificationsWeb = class extends WebPlugin {
        constructor() {
          super(...arguments);
          this.pending = [];
          this.deliveredNotifications = [];
          this.hasNotificationSupport = () => {
            if (!("Notification" in window) || !Notification.requestPermission) {
              return false;
            }
            if (Notification.permission !== "granted") {
              try {
                new Notification("");
              } catch (e) {
                if (e instanceof Error && e.name === "TypeError") {
                  return false;
                }
              }
            }
            return true;
          };
        }
        async getDeliveredNotifications() {
          const deliveredSchemas = [];
          for (const notification of this.deliveredNotifications) {
            const deliveredSchema = {
              title: notification.title,
              id: parseInt(notification.tag),
              body: notification.body
            };
            deliveredSchemas.push(deliveredSchema);
          }
          return {
            notifications: deliveredSchemas
          };
        }
        async removeDeliveredNotifications(delivered) {
          for (const toRemove of delivered.notifications) {
            const found = this.deliveredNotifications.find((n) => n.tag === String(toRemove.id));
            found === null || found === void 0 ? void 0 : found.close();
            this.deliveredNotifications = this.deliveredNotifications.filter(() => !found);
          }
        }
        async removeDeliveredNotificationsById(options) {
          for (const id of options.ids) {
            const found = this.deliveredNotifications.find((n) => n.tag === String(id));
            found === null || found === void 0 ? void 0 : found.close();
            this.deliveredNotifications = this.deliveredNotifications.filter((n) => n !== found);
          }
        }
        async removeAllDeliveredNotifications() {
          for (const notification of this.deliveredNotifications) {
            notification.close();
          }
          this.deliveredNotifications = [];
        }
        async getByIds(options) {
          const ids = options.ids.map((id) => String(id));
          const scheduled = this.pending.filter((n) => ids.includes(String(n.id)));
          const delivered = this.deliveredNotifications.filter((n) => ids.includes(n.tag)).map((n) => this.deliveredToSchema(n));
          return { notifications: [...scheduled, ...delivered] };
        }
        async getAll(options) {
          const scheduled = [...this.pending];
          const delivered = this.deliveredNotifications.map((n) => this.deliveredToSchema(n));
          if ((options === null || options === void 0 ? void 0 : options.state) === "SCHEDULED") {
            return { notifications: scheduled };
          }
          if ((options === null || options === void 0 ? void 0 : options.state) === "TRIGGERED") {
            return { notifications: delivered };
          }
          return { notifications: [...scheduled, ...delivered] };
        }
        deliveredToSchema(notification) {
          return {
            title: notification.title,
            id: parseInt(notification.tag),
            body: notification.body
          };
        }
        async createChannel() {
          throw this.unimplemented("Not implemented on web.");
        }
        async deleteChannel() {
          throw this.unimplemented("Not implemented on web.");
        }
        async listChannels() {
          throw this.unimplemented("Not implemented on web.");
        }
        async schedule(options) {
          if (!this.hasNotificationSupport()) {
            throw this.unavailable("Notifications not supported in this browser.");
          }
          for (const notification of options.notifications) {
            this.sendNotification(notification);
          }
          return {
            notifications: options.notifications.map((notification) => ({
              id: notification.id
            }))
          };
        }
        async update(options) {
          if (!this.hasNotificationSupport()) {
            throw this.unavailable("Notifications not supported in this browser.");
          }
          const updated = [];
          for (const notification of options.notifications) {
            const index = this.pending.findIndex((n) => n.id === notification.id);
            if (index === -1) {
              continue;
            }
            this.pending.splice(index, 1);
            this.sendNotification(notification);
            updated.push(notification);
          }
          return {
            notifications: updated.map((notification) => ({ id: notification.id }))
          };
        }
        async getPending() {
          return {
            notifications: this.pending
          };
        }
        async cancelAll() {
          this.pending = [];
        }
        async registerActionTypes() {
          throw this.unimplemented("Not implemented on web.");
        }
        async cancel(pending) {
          this.pending = this.pending.filter((notification) => !pending.notifications.find((n) => n.id === notification.id));
        }
        async areEnabled() {
          const { display } = await this.checkPermissions();
          return {
            value: display === "granted"
          };
        }
        async changeExactNotificationSetting() {
          throw this.unimplemented("Not implemented on web.");
        }
        async checkExactNotificationSetting() {
          throw this.unimplemented("Not implemented on web.");
        }
        async requestPermissions() {
          if (!this.hasNotificationSupport()) {
            throw this.unavailable("Notifications not supported in this browser.");
          }
          const display = this.transformNotificationPermission(await Notification.requestPermission());
          return { display };
        }
        async checkPermissions() {
          if (!this.hasNotificationSupport()) {
            throw this.unavailable("Notifications not supported in this browser.");
          }
          const display = this.transformNotificationPermission(Notification.permission);
          return { display };
        }
        transformNotificationPermission(permission) {
          switch (permission) {
            case "granted":
              return "granted";
            case "denied":
              return "denied";
            default:
              return "prompt";
          }
        }
        sendPending() {
          var _a;
          const toRemove = [];
          const now = (/* @__PURE__ */ new Date()).getTime();
          for (const notification of this.pending) {
            if (((_a = notification.schedule) === null || _a === void 0 ? void 0 : _a.at) && notification.schedule.at.getTime() <= now) {
              this.buildNotification(notification);
              toRemove.push(notification);
            }
          }
          this.pending = this.pending.filter((notification) => !toRemove.find((n) => n === notification));
        }
        sendNotification(notification) {
          var _a;
          if ((_a = notification.schedule) === null || _a === void 0 ? void 0 : _a.at) {
            const diff = notification.schedule.at.getTime() - (/* @__PURE__ */ new Date()).getTime();
            this.pending.push(notification);
            setTimeout(() => {
              this.sendPending();
            }, diff);
            return;
          }
          this.buildNotification(notification);
        }
        buildNotification(notification) {
          const localNotification = new Notification(notification.title, {
            body: notification.body,
            tag: String(notification.id)
          });
          localNotification.addEventListener("click", this.onClick.bind(this, notification), false);
          localNotification.addEventListener("show", this.onShow.bind(this, notification), false);
          localNotification.addEventListener("close", () => {
            this.deliveredNotifications = this.deliveredNotifications.filter(() => !this);
          }, false);
          this.deliveredNotifications.push(localNotification);
          return localNotification;
        }
        onClick(notification) {
          const data = {
            actionId: "tap",
            notification
          };
          this.notifyListeners("localNotificationActionPerformed", data);
        }
        onShow(notification) {
          this.notifyListeners("localNotificationReceived", notification);
        }
      };
    }
  });

  // node_modules/@capacitor/geolocation/dist/esm/web.js
  var web_exports3 = {};
  __export(web_exports3, {
    Geolocation: () => Geolocation,
    GeolocationWeb: () => GeolocationWeb
  });
  var GeolocationWeb, Geolocation;
  var init_web3 = __esm({
    "node_modules/@capacitor/geolocation/dist/esm/web.js"() {
      init_dist();
      GeolocationWeb = class extends WebPlugin {
        constructor() {
          super();
          this.latestOrientation = null;
          if (typeof window !== "undefined") {
            const win = window;
            if ("ondeviceorientationabsolute" in win) {
              win.addEventListener("deviceorientationabsolute", (event) => this.updateOrientation(event, true), true);
            } else if ("ondeviceorientation" in win) {
              win.addEventListener("deviceorientation", (event) => this.updateOrientation(event, false), true);
            }
          }
        }
        updateOrientation(event, isAbsolute) {
          let trueHeading = null;
          let magneticHeading = null;
          let headingAccuracy = null;
          if (isAbsolute && event.alpha !== null) {
            trueHeading = (360 - event.alpha) % 360;
          } else if (event.webkitCompassHeading !== void 0 && event.webkitCompassHeading !== null) {
            magneticHeading = event.webkitCompassHeading;
            headingAccuracy = event.webkitCompassAccuracy;
          } else if (event.alpha !== null && event.absolute === true) {
            trueHeading = (360 - event.alpha) % 360;
          } else if (event.alpha !== null) {
            magneticHeading = (360 - event.alpha) % 360;
          }
          if (trueHeading !== null || magneticHeading !== null) {
            this.latestOrientation = {
              trueHeading,
              magneticHeading,
              headingAccuracy
            };
          }
        }
        augmentPosition(pos, isWatch = false) {
          var _a, _b, _c, _d, _e, _f, _g;
          const coords = pos.coords;
          const orientation = isWatch ? this.latestOrientation : null;
          const heading = (_c = (_b = (_a = orientation === null || orientation === void 0 ? void 0 : orientation.trueHeading) !== null && _a !== void 0 ? _a : orientation === null || orientation === void 0 ? void 0 : orientation.magneticHeading) !== null && _b !== void 0 ? _b : isWatch ? coords.heading : null) !== null && _c !== void 0 ? _c : null;
          return {
            timestamp: pos.timestamp,
            coords: {
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy,
              altitude: coords.altitude,
              altitudeAccuracy: coords.altitudeAccuracy,
              speed: coords.speed,
              heading,
              magneticHeading: (_d = orientation === null || orientation === void 0 ? void 0 : orientation.magneticHeading) !== null && _d !== void 0 ? _d : null,
              trueHeading: (_e = orientation === null || orientation === void 0 ? void 0 : orientation.trueHeading) !== null && _e !== void 0 ? _e : null,
              headingAccuracy: (_f = orientation === null || orientation === void 0 ? void 0 : orientation.headingAccuracy) !== null && _f !== void 0 ? _f : null,
              course: (_g = isWatch ? coords.heading : null) !== null && _g !== void 0 ? _g : null
            }
          };
        }
        async getCurrentPosition(options) {
          return new Promise((resolve2, reject) => {
            navigator.geolocation.getCurrentPosition((pos) => {
              resolve2(this.augmentPosition(pos, false));
            }, (err) => {
              reject(err);
            }, Object.assign({ enableHighAccuracy: false, timeout: 1e4, maximumAge: 0 }, options));
          });
        }
        async watchPosition(options, callback) {
          const id = navigator.geolocation.watchPosition((pos) => {
            callback(this.augmentPosition(pos, true));
          }, (err) => {
            callback(null, err);
          }, Object.assign({ enableHighAccuracy: false, timeout: 1e4, maximumAge: 0, minimumUpdateInterval: 5e3 }, options));
          return `${id}`;
        }
        async clearWatch(options) {
          navigator.geolocation.clearWatch(parseInt(options.id, 10));
        }
        async checkPermissions() {
          if (typeof navigator === "undefined" || !navigator.permissions) {
            throw this.unavailable("Permissions API not available in this browser");
          }
          const permission = await navigator.permissions.query({
            name: "geolocation"
          });
          return { location: permission.state, coarseLocation: permission.state };
        }
        async requestPermissions() {
          throw this.unimplemented("Not implemented on web.");
        }
      };
      Geolocation = new GeolocationWeb();
    }
  });

  // node_modules/@capacitor/filesystem/dist/esm/definitions.js
  var Directory, Encoding;
  var init_definitions = __esm({
    "node_modules/@capacitor/filesystem/dist/esm/definitions.js"() {
      (function(Directory2) {
        Directory2["Documents"] = "DOCUMENTS";
        Directory2["Data"] = "DATA";
        Directory2["Library"] = "LIBRARY";
        Directory2["Cache"] = "CACHE";
        Directory2["External"] = "EXTERNAL";
        Directory2["ExternalStorage"] = "EXTERNAL_STORAGE";
        Directory2["ExternalCache"] = "EXTERNAL_CACHE";
        Directory2["LibraryNoCloud"] = "LIBRARY_NO_CLOUD";
        Directory2["Temporary"] = "TEMPORARY";
      })(Directory || (Directory = {}));
      (function(Encoding2) {
        Encoding2["UTF8"] = "utf8";
        Encoding2["ASCII"] = "ascii";
        Encoding2["UTF16"] = "utf16";
      })(Encoding || (Encoding = {}));
    }
  });

  // node_modules/@capacitor/filesystem/dist/esm/web.js
  var web_exports4 = {};
  __export(web_exports4, {
    FilesystemWeb: () => FilesystemWeb
  });
  function resolve(path) {
    const posix = path.split("/").filter((item) => item !== ".");
    const newPosix = [];
    posix.forEach((item) => {
      if (item === ".." && newPosix.length > 0 && newPosix[newPosix.length - 1] !== "..") {
        newPosix.pop();
      } else {
        newPosix.push(item);
      }
    });
    return newPosix.join("/");
  }
  function isPathParent(parent, children) {
    parent = resolve(parent);
    children = resolve(children);
    const pathsA = parent.split("/");
    const pathsB = children.split("/");
    return parent !== children && pathsA.every((value, index) => value === pathsB[index]);
  }
  var FilesystemWeb;
  var init_web4 = __esm({
    "node_modules/@capacitor/filesystem/dist/esm/web.js"() {
      init_dist();
      init_definitions();
      FilesystemWeb = class _FilesystemWeb extends WebPlugin {
        constructor() {
          super(...arguments);
          this.DB_VERSION = 1;
          this.DB_NAME = "Disc";
          this._writeCmds = ["add", "put", "delete"];
          this.downloadFile = async (options) => {
            var _a, _b;
            const requestInit = buildRequestInit(options, options.webFetchExtra);
            const response = await fetch(options.url, requestInit);
            let blob;
            if (!options.progress)
              blob = await response.blob();
            else if (!(response === null || response === void 0 ? void 0 : response.body))
              blob = new Blob();
            else {
              const reader = response.body.getReader();
              let bytes = 0;
              const chunks = [];
              const contentType = response.headers.get("content-type");
              const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
              while (true) {
                const { done, value } = await reader.read();
                if (done)
                  break;
                chunks.push(value);
                bytes += (value === null || value === void 0 ? void 0 : value.length) || 0;
                const status = {
                  url: options.url,
                  bytes,
                  contentLength
                };
                this.notifyListeners("progress", status);
              }
              const allChunks = new Uint8Array(bytes);
              let position = 0;
              for (const chunk of chunks) {
                if (typeof chunk === "undefined")
                  continue;
                allChunks.set(chunk, position);
                position += chunk.length;
              }
              blob = new Blob([allChunks.buffer], { type: contentType || void 0 });
            }
            const result = await this.writeFile({
              path: options.path,
              directory: (_a = options.directory) !== null && _a !== void 0 ? _a : void 0,
              recursive: (_b = options.recursive) !== null && _b !== void 0 ? _b : false,
              data: blob
            });
            return { path: result.uri, blob };
          };
        }
        readFileInChunks(_options, _callback) {
          throw this.unavailable("Method not implemented.");
        }
        async initDb() {
          if (this._db !== void 0) {
            return this._db;
          }
          if (!("indexedDB" in window)) {
            throw this.unavailable("This browser doesn't support IndexedDB");
          }
          return new Promise((resolve2, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            request.onupgradeneeded = _FilesystemWeb.doUpgrade;
            request.onsuccess = () => {
              this._db = request.result;
              resolve2(request.result);
            };
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
              console.warn("db blocked");
            };
          });
        }
        static doUpgrade(event) {
          const eventTarget = event.target;
          const db = eventTarget.result;
          switch (event.oldVersion) {
            case 0:
            case 1:
            default: {
              if (db.objectStoreNames.contains("FileStorage")) {
                db.deleteObjectStore("FileStorage");
              }
              const store = db.createObjectStore("FileStorage", { keyPath: "path" });
              store.createIndex("by_folder", "folder");
            }
          }
        }
        async dbRequest(cmd, args) {
          const readFlag = this._writeCmds.indexOf(cmd) !== -1 ? "readwrite" : "readonly";
          return this.initDb().then((conn) => {
            return new Promise((resolve2, reject) => {
              const tx = conn.transaction(["FileStorage"], readFlag);
              const store = tx.objectStore("FileStorage");
              const req = store[cmd](...args);
              req.onsuccess = () => resolve2(req.result);
              req.onerror = () => reject(req.error);
            });
          });
        }
        async dbIndexRequest(indexName, cmd, args) {
          const readFlag = this._writeCmds.indexOf(cmd) !== -1 ? "readwrite" : "readonly";
          return this.initDb().then((conn) => {
            return new Promise((resolve2, reject) => {
              const tx = conn.transaction(["FileStorage"], readFlag);
              const store = tx.objectStore("FileStorage");
              const index = store.index(indexName);
              const req = index[cmd](...args);
              req.onsuccess = () => resolve2(req.result);
              req.onerror = () => reject(req.error);
            });
          });
        }
        getPath(directory, uriPath) {
          const cleanedUriPath = uriPath !== void 0 ? uriPath.replace(/^[/]+|[/]+$/g, "") : "";
          let fsPath = "";
          if (directory !== void 0)
            fsPath += "/" + directory;
          if (uriPath !== "")
            fsPath += "/" + cleanedUriPath;
          return fsPath;
        }
        async clear() {
          const conn = await this.initDb();
          const tx = conn.transaction(["FileStorage"], "readwrite");
          const store = tx.objectStore("FileStorage");
          store.clear();
        }
        /**
         * Read a file from disk
         * @param options options for the file read
         * @return a promise that resolves with the read file data result
         */
        async readFile(options) {
          const path = this.getPath(options.directory, options.path);
          const entry = await this.dbRequest("get", [path]);
          if (entry === void 0)
            throw Error("File does not exist.");
          return { data: entry.content ? entry.content : "" };
        }
        /**
         * Write a file to disk in the specified location on device
         * @param options options for the file write
         * @return a promise that resolves with the file write result
         */
        async writeFile(options) {
          const path = this.getPath(options.directory, options.path);
          let data = options.data;
          const encoding = options.encoding;
          const doRecursive = options.recursive;
          const occupiedEntry = await this.dbRequest("get", [path]);
          if (occupiedEntry && occupiedEntry.type === "directory")
            throw Error("The supplied path is a directory.");
          const parentPath = path.substr(0, path.lastIndexOf("/"));
          const parentEntry = await this.dbRequest("get", [parentPath]);
          if (parentEntry === void 0) {
            const subDirIndex = parentPath.indexOf("/", 1);
            if (subDirIndex !== -1) {
              const parentArgPath = parentPath.substr(subDirIndex);
              await this.mkdir({
                path: parentArgPath,
                directory: options.directory,
                recursive: doRecursive
              });
            }
          }
          if (!encoding && !(data instanceof Blob)) {
            data = data.indexOf(",") >= 0 ? data.split(",")[1] : data;
            if (!this.isBase64String(data))
              throw Error("The supplied data is not valid base64 content.");
          }
          const now = Date.now();
          const pathObj = {
            path,
            folder: parentPath,
            type: "file",
            size: data instanceof Blob ? data.size : data.length,
            ctime: now,
            mtime: now,
            content: data
          };
          await this.dbRequest("put", [pathObj]);
          return {
            uri: pathObj.path
          };
        }
        /**
         * Append to a file on disk in the specified location on device
         * @param options options for the file append
         * @return a promise that resolves with the file write result
         */
        async appendFile(options) {
          const path = this.getPath(options.directory, options.path);
          let data = options.data;
          const encoding = options.encoding;
          const parentPath = path.substr(0, path.lastIndexOf("/"));
          const now = Date.now();
          let ctime = now;
          const occupiedEntry = await this.dbRequest("get", [path]);
          if (occupiedEntry && occupiedEntry.type === "directory")
            throw Error("The supplied path is a directory.");
          const parentEntry = await this.dbRequest("get", [parentPath]);
          if (parentEntry === void 0) {
            const subDirIndex = parentPath.indexOf("/", 1);
            if (subDirIndex !== -1) {
              const parentArgPath = parentPath.substr(subDirIndex);
              await this.mkdir({
                path: parentArgPath,
                directory: options.directory,
                recursive: true
              });
            }
          }
          if (!encoding && !this.isBase64String(data))
            throw Error("The supplied data is not valid base64 content.");
          if (occupiedEntry !== void 0) {
            if (occupiedEntry.content instanceof Blob) {
              throw Error("The occupied entry contains a Blob object which cannot be appended to.");
            }
            if (occupiedEntry.content !== void 0 && !encoding) {
              data = btoa(atob(occupiedEntry.content) + atob(data));
            } else {
              data = occupiedEntry.content + data;
            }
            ctime = occupiedEntry.ctime;
          }
          const pathObj = {
            path,
            folder: parentPath,
            type: "file",
            size: data.length,
            ctime,
            mtime: now,
            content: data
          };
          await this.dbRequest("put", [pathObj]);
        }
        /**
         * Delete a file from disk
         * @param options options for the file delete
         * @return a promise that resolves with the deleted file data result
         */
        async deleteFile(options) {
          const path = this.getPath(options.directory, options.path);
          const entry = await this.dbRequest("get", [path]);
          if (entry === void 0)
            throw Error("File does not exist.");
          const entries = await this.dbIndexRequest("by_folder", "getAllKeys", [IDBKeyRange.only(path)]);
          if (entries.length !== 0)
            throw Error("Folder is not empty.");
          await this.dbRequest("delete", [path]);
        }
        /**
         * Create a directory.
         * @param options options for the mkdir
         * @return a promise that resolves with the mkdir result
         */
        async mkdir(options) {
          const path = this.getPath(options.directory, options.path);
          const doRecursive = options.recursive;
          const parentPath = path.substr(0, path.lastIndexOf("/"));
          const depth = (path.match(/\//g) || []).length;
          const parentEntry = await this.dbRequest("get", [parentPath]);
          const occupiedEntry = await this.dbRequest("get", [path]);
          if (depth === 1)
            throw Error("Cannot create Root directory");
          if (occupiedEntry !== void 0)
            throw Error("Current directory does already exist.");
          if (!doRecursive && depth !== 2 && parentEntry === void 0)
            throw Error("Parent directory must exist");
          if (doRecursive && depth !== 2 && parentEntry === void 0) {
            const parentArgPath = parentPath.substr(parentPath.indexOf("/", 1));
            await this.mkdir({
              path: parentArgPath,
              directory: options.directory,
              recursive: doRecursive
            });
          }
          const now = Date.now();
          const pathObj = {
            path,
            folder: parentPath,
            type: "directory",
            size: 0,
            ctime: now,
            mtime: now
          };
          await this.dbRequest("put", [pathObj]);
        }
        /**
         * Remove a directory
         * @param options the options for the directory remove
         */
        async rmdir(options) {
          const { path, directory, recursive } = options;
          const fullPath = this.getPath(directory, path);
          const entry = await this.dbRequest("get", [fullPath]);
          if (entry === void 0)
            throw Error("Folder does not exist.");
          if (entry.type !== "directory")
            throw Error("Requested path is not a directory");
          const readDirResult = await this.readdir({ path, directory });
          if (readDirResult.files.length !== 0 && !recursive)
            throw Error("Folder is not empty");
          for (const entry2 of readDirResult.files) {
            const entryPath = `${path}/${entry2.name}`;
            const entryObj = await this.stat({ path: entryPath, directory });
            if (entryObj.type === "file") {
              await this.deleteFile({ path: entryPath, directory });
            } else {
              await this.rmdir({ path: entryPath, directory, recursive });
            }
          }
          await this.dbRequest("delete", [fullPath]);
        }
        /**
         * Return a list of files from the directory (not recursive)
         * @param options the options for the readdir operation
         * @return a promise that resolves with the readdir directory listing result
         */
        async readdir(options) {
          const path = this.getPath(options.directory, options.path);
          const entry = await this.dbRequest("get", [path]);
          if (options.path !== "" && entry === void 0)
            throw Error("Folder does not exist.");
          const entries = await this.dbIndexRequest("by_folder", "getAllKeys", [IDBKeyRange.only(path)]);
          const files = await Promise.all(entries.map(async (e) => {
            let subEntry = await this.dbRequest("get", [e]);
            if (subEntry === void 0) {
              subEntry = await this.dbRequest("get", [e + "/"]);
            }
            return {
              name: e.substring(path.length + 1),
              type: subEntry.type,
              size: subEntry.size,
              ctime: subEntry.ctime,
              mtime: subEntry.mtime,
              uri: subEntry.path
            };
          }));
          return { files };
        }
        /**
         * Return full File URI for a path and directory
         * @param options the options for the stat operation
         * @return a promise that resolves with the file stat result
         */
        async getUri(options) {
          const path = this.getPath(options.directory, options.path);
          let entry = await this.dbRequest("get", [path]);
          if (entry === void 0) {
            entry = await this.dbRequest("get", [path + "/"]);
          }
          return {
            uri: (entry === null || entry === void 0 ? void 0 : entry.path) || path
          };
        }
        /**
         * Return data about a file
         * @param options the options for the stat operation
         * @return a promise that resolves with the file stat result
         */
        async stat(options) {
          const path = this.getPath(options.directory, options.path);
          let entry = await this.dbRequest("get", [path]);
          if (entry === void 0) {
            entry = await this.dbRequest("get", [path + "/"]);
          }
          if (entry === void 0)
            throw Error("Entry does not exist.");
          return {
            name: entry.path.substring(path.length + 1),
            type: entry.type,
            size: entry.size,
            ctime: entry.ctime,
            mtime: entry.mtime,
            uri: entry.path
          };
        }
        /**
         * Rename a file or directory
         * @param options the options for the rename operation
         * @return a promise that resolves with the rename result
         */
        async rename(options) {
          await this._copy(options, true);
          return;
        }
        /**
         * Copy a file or directory
         * @param options the options for the copy operation
         * @return a promise that resolves with the copy result
         */
        async copy(options) {
          return this._copy(options, false);
        }
        async requestPermissions() {
          return { publicStorage: "granted" };
        }
        async checkPermissions() {
          return { publicStorage: "granted" };
        }
        /**
         * Function that can perform a copy or a rename
         * @param options the options for the rename operation
         * @param doRename whether to perform a rename or copy operation
         * @return a promise that resolves with the result
         */
        async _copy(options, doRename = false) {
          let { toDirectory } = options;
          const { to, from, directory: fromDirectory } = options;
          if (!to || !from) {
            throw Error("Both to and from must be provided");
          }
          if (!toDirectory) {
            toDirectory = fromDirectory;
          }
          const fromPath = this.getPath(fromDirectory, from);
          const toPath = this.getPath(toDirectory, to);
          if (fromPath === toPath) {
            return {
              uri: toPath
            };
          }
          if (isPathParent(fromPath, toPath)) {
            throw Error("To path cannot contain the from path");
          }
          let toObj;
          try {
            toObj = await this.stat({
              path: to,
              directory: toDirectory
            });
          } catch (e) {
            const toPathComponents = to.split("/");
            toPathComponents.pop();
            const toPath2 = toPathComponents.join("/");
            if (toPathComponents.length > 0) {
              const toParentDirectory = await this.stat({
                path: toPath2,
                directory: toDirectory
              });
              if (toParentDirectory.type !== "directory") {
                throw new Error("Parent directory of the to path is a file");
              }
            }
          }
          if (toObj && toObj.type === "directory") {
            throw new Error("Cannot overwrite a directory with a file");
          }
          const fromObj = await this.stat({
            path: from,
            directory: fromDirectory
          });
          const updateTime = async (path, ctime2, mtime) => {
            const fullPath = this.getPath(toDirectory, path);
            const entry = await this.dbRequest("get", [fullPath]);
            entry.ctime = ctime2;
            entry.mtime = mtime;
            await this.dbRequest("put", [entry]);
          };
          const ctime = fromObj.ctime ? fromObj.ctime : Date.now();
          switch (fromObj.type) {
            // The "from" object is a file
            case "file": {
              const file = await this.readFile({
                path: from,
                directory: fromDirectory
              });
              if (doRename) {
                await this.deleteFile({
                  path: from,
                  directory: fromDirectory
                });
              }
              let encoding;
              if (!(file.data instanceof Blob) && !this.isBase64String(file.data)) {
                encoding = Encoding.UTF8;
              }
              const writeResult = await this.writeFile({
                path: to,
                directory: toDirectory,
                data: file.data,
                encoding
              });
              if (doRename) {
                await updateTime(to, ctime, fromObj.mtime);
              }
              return writeResult;
            }
            case "directory": {
              if (toObj) {
                throw Error("Cannot move a directory over an existing object");
              }
              try {
                await this.mkdir({
                  path: to,
                  directory: toDirectory,
                  recursive: false
                });
                if (doRename) {
                  await updateTime(to, ctime, fromObj.mtime);
                }
              } catch (e) {
              }
              const contents = (await this.readdir({
                path: from,
                directory: fromDirectory
              })).files;
              for (const filename of contents) {
                await this._copy({
                  from: `${from}/${filename.name}`,
                  to: `${to}/${filename.name}`,
                  directory: fromDirectory,
                  toDirectory
                }, doRename);
              }
              if (doRename) {
                await this.rmdir({
                  path: from,
                  directory: fromDirectory
                });
              }
            }
          }
          return {
            uri: toPath
          };
        }
        isBase64String(str) {
          try {
            return btoa(atob(str)) == str;
          } catch (err) {
            return false;
          }
        }
      };
      FilesystemWeb._debug = true;
    }
  });

  // node_modules/@capacitor/app/dist/esm/web.js
  var web_exports5 = {};
  __export(web_exports5, {
    AppWeb: () => AppWeb
  });
  var AppWeb;
  var init_web5 = __esm({
    "node_modules/@capacitor/app/dist/esm/web.js"() {
      init_dist();
      AppWeb = class extends WebPlugin {
        constructor() {
          super();
          this.handleVisibilityChange = () => {
            const data = {
              isActive: document.hidden !== true
            };
            this.notifyListeners("appStateChange", data);
            if (document.hidden) {
              this.notifyListeners("pause", null);
            } else {
              this.notifyListeners("resume", null);
            }
          };
          document.addEventListener("visibilitychange", this.handleVisibilityChange, false);
        }
        exitApp() {
          throw this.unimplemented("Not implemented on web.");
        }
        async getInfo() {
          throw this.unimplemented("Not implemented on web.");
        }
        async getLaunchUrl() {
          return { url: "" };
        }
        async getState() {
          return { isActive: document.hidden !== true };
        }
        async minimizeApp() {
          throw this.unimplemented("Not implemented on web.");
        }
        async toggleBackButtonHandler() {
          throw this.unimplemented("Not implemented on web.");
        }
        async getAppLanguage() {
          return {
            value: navigator.language.split("-")[0].toLowerCase()
          };
        }
      };
    }
  });

  // node_modules/@capacitor/splash-screen/dist/esm/web.js
  var web_exports6 = {};
  __export(web_exports6, {
    SplashScreenWeb: () => SplashScreenWeb
  });
  var SplashScreenWeb;
  var init_web6 = __esm({
    "node_modules/@capacitor/splash-screen/dist/esm/web.js"() {
      init_dist();
      SplashScreenWeb = class extends WebPlugin {
        async show(_options) {
          return void 0;
        }
        async hide(_options) {
          return void 0;
        }
      };
    }
  });

  // node_modules/@capgo/capacitor-updater/dist/esm/definitions.js
  var AppUpdateAvailability, FlexibleUpdateInstallStatus, AppUpdateResultCode;
  var init_definitions2 = __esm({
    "node_modules/@capgo/capacitor-updater/dist/esm/definitions.js"() {
      (function(AppUpdateAvailability2) {
        AppUpdateAvailability2[AppUpdateAvailability2["UNKNOWN"] = 0] = "UNKNOWN";
        AppUpdateAvailability2[AppUpdateAvailability2["UPDATE_NOT_AVAILABLE"] = 1] = "UPDATE_NOT_AVAILABLE";
        AppUpdateAvailability2[AppUpdateAvailability2["UPDATE_AVAILABLE"] = 2] = "UPDATE_AVAILABLE";
        AppUpdateAvailability2[AppUpdateAvailability2["UPDATE_IN_PROGRESS"] = 3] = "UPDATE_IN_PROGRESS";
      })(AppUpdateAvailability || (AppUpdateAvailability = {}));
      (function(FlexibleUpdateInstallStatus2) {
        FlexibleUpdateInstallStatus2[FlexibleUpdateInstallStatus2["UNKNOWN"] = 0] = "UNKNOWN";
        FlexibleUpdateInstallStatus2[FlexibleUpdateInstallStatus2["PENDING"] = 1] = "PENDING";
        FlexibleUpdateInstallStatus2[FlexibleUpdateInstallStatus2["DOWNLOADING"] = 2] = "DOWNLOADING";
        FlexibleUpdateInstallStatus2[FlexibleUpdateInstallStatus2["INSTALLING"] = 3] = "INSTALLING";
        FlexibleUpdateInstallStatus2[FlexibleUpdateInstallStatus2["INSTALLED"] = 4] = "INSTALLED";
        FlexibleUpdateInstallStatus2[FlexibleUpdateInstallStatus2["FAILED"] = 5] = "FAILED";
        FlexibleUpdateInstallStatus2[FlexibleUpdateInstallStatus2["CANCELED"] = 6] = "CANCELED";
        FlexibleUpdateInstallStatus2[FlexibleUpdateInstallStatus2["DOWNLOADED"] = 11] = "DOWNLOADED";
      })(FlexibleUpdateInstallStatus || (FlexibleUpdateInstallStatus = {}));
      (function(AppUpdateResultCode2) {
        AppUpdateResultCode2[AppUpdateResultCode2["OK"] = 0] = "OK";
        AppUpdateResultCode2[AppUpdateResultCode2["CANCELED"] = 1] = "CANCELED";
        AppUpdateResultCode2[AppUpdateResultCode2["FAILED"] = 2] = "FAILED";
        AppUpdateResultCode2[AppUpdateResultCode2["NOT_AVAILABLE"] = 3] = "NOT_AVAILABLE";
        AppUpdateResultCode2[AppUpdateResultCode2["NOT_ALLOWED"] = 4] = "NOT_ALLOWED";
        AppUpdateResultCode2[AppUpdateResultCode2["INFO_MISSING"] = 5] = "INFO_MISSING";
      })(AppUpdateResultCode || (AppUpdateResultCode = {}));
    }
  });

  // node_modules/@capgo/capacitor-updater/dist/esm/web.js
  var web_exports7 = {};
  __export(web_exports7, {
    CapacitorUpdaterWeb: () => CapacitorUpdaterWeb
  });
  var BUNDLE_BUILTIN, CapacitorUpdaterWeb;
  var init_web7 = __esm({
    "node_modules/@capgo/capacitor-updater/dist/esm/web.js"() {
      init_dist();
      init_definitions2();
      BUNDLE_BUILTIN = {
        status: "success",
        version: "",
        downloaded: "1970-01-01T00:00:00.000Z",
        id: "builtin",
        checksum: ""
      };
      CapacitorUpdaterWeb = class extends WebPlugin {
        async setStatsUrl(options) {
          console.warn("Cannot setStatsUrl in web", options);
          return;
        }
        async setUpdateUrl(options) {
          console.warn("Cannot setUpdateUrl in web", options);
          return;
        }
        async setChannelUrl(options) {
          console.warn("Cannot setChannelUrl in web", options);
          return;
        }
        async download(options) {
          console.warn("Cannot download version in web", options);
          return BUNDLE_BUILTIN;
        }
        async next(options) {
          console.warn("Cannot set next version in web", options);
          return BUNDLE_BUILTIN;
        }
        async isAutoUpdateEnabled() {
          console.warn("Cannot get isAutoUpdateEnabled in web");
          return { enabled: false };
        }
        async set(options) {
          console.warn("Cannot set active bundle in web", options);
          return;
        }
        async startPreviewSession(options) {
          console.warn("Cannot start preview session in web", options);
          return;
        }
        async listPreviews() {
          console.warn("Cannot list previews in web");
          return { previews: [], currentBundle: BUNDLE_BUILTIN };
        }
        async setPreview(options) {
          console.warn("Cannot set preview in web", options);
          return;
        }
        async resetPreview() {
          console.warn("Cannot reset preview in web");
          return;
        }
        async deletePreview(options) {
          console.warn("Cannot delete preview in web", options);
          return { removed: false, deleted: false };
        }
        async checkPreviewUpdate(options) {
          console.warn("Cannot check preview update in web", options);
          throw this.unimplemented("Preview updates are not available on web platform");
        }
        async updatePreview(options) {
          console.warn("Cannot update preview in web", options);
          throw this.unimplemented("Preview updates are not available on web platform");
        }
        async getDeviceId() {
          console.warn("Cannot get ID in web");
          return { deviceId: "default" };
        }
        async getBuiltinVersion() {
          console.warn("Cannot get version in web");
          return { version: "default" };
        }
        async getPluginVersion() {
          console.warn("Cannot get plugin version in web");
          return { version: "default" };
        }
        async delete(options) {
          console.warn("Cannot delete bundle in web", options);
        }
        async setBundleError(options) {
          console.warn("Cannot setBundleError in web", options);
          return BUNDLE_BUILTIN;
        }
        async list() {
          console.warn("Cannot list bundles in web");
          return { bundles: [] };
        }
        async reset(options) {
          console.warn("Cannot reset version in web", options);
        }
        async current() {
          console.warn("Cannot get current bundle in web");
          return { bundle: BUNDLE_BUILTIN, native: "0.0.0" };
        }
        async reload() {
          console.warn("Cannot reload current bundle in web");
          return;
        }
        async getLatest() {
          console.warn("Cannot getLatest current bundle in web");
          return {
            version: "0.0.0",
            message: "Cannot getLatest current bundle in web"
          };
        }
        async triggerUpdateCheck() {
          console.warn("Cannot triggerUpdateCheck in web");
          return { status: "unavailable", queued: false };
        }
        async getMissingBundleFiles(options) {
          var _a, _b, _c;
          console.warn("Cannot inspect missing bundle files in web", { manifestLength: (_b = (_a = options.manifest) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0 });
          const missing = (_c = options.manifest) !== null && _c !== void 0 ? _c : [];
          return {
            missing,
            total: missing.length,
            missingCount: missing.length,
            reusableCount: 0
          };
        }
        async getBundleDownloadSize(options) {
          var _a, _b, _c, _d, _e;
          console.warn("Cannot estimate bundle download size in web", { manifestLength: (_b = (_a = options.manifest) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0 });
          return {
            totalSize: 0,
            knownFiles: 0,
            unknownFiles: (_d = (_c = options.manifest) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0,
            files: ((_e = options.manifest) !== null && _e !== void 0 ? _e : []).map((entry) => ({
              file_name: entry.file_name,
              file_hash: entry.file_hash,
              download_url: entry.download_url,
              error: "unavailable"
            }))
          };
        }
        async setChannel(options) {
          console.warn("Cannot setChannel in web", options);
          return {
            status: "error",
            error: "Cannot setChannel in web"
          };
        }
        async unsetChannel(options) {
          console.warn("Cannot unsetChannel in web", options);
          return;
        }
        async setCustomId(options) {
          console.warn("Cannot setCustomId in web", options);
          return;
        }
        async getChannel() {
          console.warn("Cannot getChannel in web");
          return {
            status: "error",
            error: "Cannot getChannel in web"
          };
        }
        async listChannels() {
          console.warn("Cannot listChannels in web");
          throw {
            message: "Cannot listChannels in web",
            error: "platform_not_supported"
          };
        }
        async notifyAppReady() {
          return { bundle: BUNDLE_BUILTIN };
        }
        async setMultiDelay(options) {
          console.warn("Cannot setMultiDelay in web", options === null || options === void 0 ? void 0 : options.delayConditions);
          return;
        }
        async cancelDelay() {
          console.warn("Cannot cancelDelay in web");
          return;
        }
        async isAutoUpdateAvailable() {
          console.warn("Cannot isAutoUpdateAvailable in web");
          return { available: false };
        }
        async getCurrentBundle() {
          console.warn("Cannot get current bundle in web");
          return BUNDLE_BUILTIN;
        }
        async getNextBundle() {
          return Promise.resolve(null);
        }
        async getFailedUpdate() {
          console.warn("Cannot getFailedUpdate in web");
          return null;
        }
        async setShakeMenu(_options) {
          throw this.unimplemented("Shake menu not available on web platform");
        }
        async isShakeMenuEnabled() {
          return Promise.resolve({ enabled: false, gesture: "shake" });
        }
        async setShakeChannelSelector(_options) {
          throw this.unimplemented("Shake channel selector not available on web platform");
        }
        async isShakeChannelSelectorEnabled() {
          return Promise.resolve({ enabled: false });
        }
        async getAppId() {
          console.warn("Cannot getAppId in web");
          return { appId: "default" };
        }
        async setAppId(options) {
          console.warn("Cannot setAppId in web", options);
          return;
        }
        // ============================================================================
        // App Store / Play Store Update Methods (Web stubs)
        // ============================================================================
        async getAppUpdateInfo(_options) {
          console.warn("getAppUpdateInfo is not available on web platform");
          return {
            currentVersionName: "0.0.0",
            currentVersionCode: "0",
            updateAvailability: AppUpdateAvailability.UNKNOWN
          };
        }
        async openAppStore(_options) {
          throw this.unimplemented("openAppStore is not available on web platform");
        }
        async performImmediateUpdate() {
          throw this.unimplemented("performImmediateUpdate is only available on Android");
        }
        async startFlexibleUpdate() {
          throw this.unimplemented("startFlexibleUpdate is only available on Android");
        }
        async completeFlexibleUpdate() {
          throw this.unimplemented("completeFlexibleUpdate is only available on Android");
        }
      };
    }
  });

  // src/native.js
  init_dist();

  // node_modules/@capacitor/preferences/dist/esm/index.js
  init_dist();
  var Preferences = registerPlugin("Preferences", {
    web: () => Promise.resolve().then(() => (init_web(), web_exports)).then((m) => new m.PreferencesWeb())
  });

  // node_modules/@capacitor/local-notifications/dist/esm/index.js
  init_dist();

  // node_modules/@capacitor/local-notifications/dist/esm/definitions.js
  var Weekday;
  (function(Weekday2) {
    Weekday2[Weekday2["Sunday"] = 1] = "Sunday";
    Weekday2[Weekday2["Monday"] = 2] = "Monday";
    Weekday2[Weekday2["Tuesday"] = 3] = "Tuesday";
    Weekday2[Weekday2["Wednesday"] = 4] = "Wednesday";
    Weekday2[Weekday2["Thursday"] = 5] = "Thursday";
    Weekday2[Weekday2["Friday"] = 6] = "Friday";
    Weekday2[Weekday2["Saturday"] = 7] = "Saturday";
  })(Weekday || (Weekday = {}));

  // node_modules/@capacitor/local-notifications/dist/esm/index.js
  var LocalNotifications = registerPlugin("LocalNotifications", {
    web: () => Promise.resolve().then(() => (init_web2(), web_exports2)).then((m) => new m.LocalNotificationsWeb())
  });

  // node_modules/@capacitor/geolocation/dist/esm/index.js
  init_dist();

  // node_modules/@capacitor/synapse/dist/synapse.mjs
  function s(t) {
    t.CapacitorUtils.Synapse = new Proxy(
      {},
      {
        get(e, n) {
          return new Proxy({}, {
            get(w, o) {
              return (c, p, r) => {
                const i = t.Capacitor.Plugins[n];
                if (i === void 0) {
                  r(new Error(`Capacitor plugin ${n} not found`));
                  return;
                }
                if (typeof i[o] != "function") {
                  r(new Error(`Method ${o} not found in Capacitor plugin ${n}`));
                  return;
                }
                (async () => {
                  try {
                    const a = await i[o](c);
                    p(a);
                  } catch (a) {
                    r(a);
                  }
                })();
              };
            }
          });
        }
      }
    );
  }
  function u(t) {
    t.CapacitorUtils.Synapse = new Proxy(
      {},
      {
        get(e, n) {
          return t.cordova.plugins[n];
        }
      }
    );
  }
  function f(t = false) {
    typeof window > "u" || (window.CapacitorUtils = window.CapacitorUtils || {}, window.Capacitor !== void 0 && !t ? s(window) : window.cordova !== void 0 && u(window));
  }

  // node_modules/@capacitor/geolocation/dist/esm/index.js
  var Geolocation2 = registerPlugin("Geolocation", {
    web: () => Promise.resolve().then(() => (init_web3(), web_exports3)).then((m) => new m.GeolocationWeb())
  });
  f();

  // node_modules/@capacitor/filesystem/dist/esm/index.js
  init_dist();
  init_definitions();
  var Filesystem = registerPlugin("Filesystem", {
    web: () => Promise.resolve().then(() => (init_web4(), web_exports4)).then((m) => new m.FilesystemWeb())
  });
  f();

  // node_modules/@capacitor/app/dist/esm/index.js
  init_dist();
  var App = registerPlugin("App", {
    web: () => Promise.resolve().then(() => (init_web5(), web_exports5)).then((m) => new m.AppWeb())
  });

  // node_modules/@capacitor/splash-screen/dist/esm/index.js
  init_dist();
  var SplashScreen = registerPlugin("SplashScreen", {
    web: () => Promise.resolve().then(() => (init_web6(), web_exports6)).then((m) => new m.SplashScreenWeb())
  });

  // node_modules/@capgo/capacitor-updater/dist/esm/index.js
  init_dist();

  // node_modules/@capgo/capacitor-updater/dist/esm/history.js
  var KEEP_FLAG_KEY = "__capgo_keep_url_path_after_reload";
  var HISTORY_STORAGE_KEY = "__capgo_history_stack__";
  var MAX_STACK_ENTRIES = 100;
  var isBrowser = typeof window !== "undefined" && typeof document !== "undefined" && typeof history !== "undefined";
  if (isBrowser) {
    const win = window;
    if (!win.__capgoHistoryPatched) {
      win.__capgoHistoryPatched = true;
      const isFeatureConfigured = () => {
        try {
          if (win.__capgoKeepUrlPathAfterReload) {
            return true;
          }
        } catch (err) {
        }
        try {
          return window.localStorage.getItem(KEEP_FLAG_KEY) === "1";
        } catch (err) {
          return false;
        }
      };
      const readStored = () => {
        try {
          const raw = window.sessionStorage.getItem(HISTORY_STORAGE_KEY);
          if (!raw) {
            return { stack: [], index: -1 };
          }
          const parsed = JSON.parse(raw);
          if (!parsed || !Array.isArray(parsed.stack) || typeof parsed.index !== "number") {
            return { stack: [], index: -1 };
          }
          return parsed;
        } catch (err) {
          return { stack: [], index: -1 };
        }
      };
      const writeStored = (stack, index) => {
        try {
          window.sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ stack, index }));
        } catch (err) {
        }
      };
      const clearStored = () => {
        try {
          window.sessionStorage.removeItem(HISTORY_STORAGE_KEY);
        } catch (err) {
        }
      };
      const normalize = (url) => {
        try {
          const base = url !== null && url !== void 0 ? url : window.location.href;
          const parsed = new URL(base instanceof URL ? base.toString() : base, window.location.href);
          return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        } catch (err) {
          return null;
        }
      };
      const trimStack = (stack, index) => {
        if (stack.length <= MAX_STACK_ENTRIES) {
          return { stack, index };
        }
        const start = stack.length - MAX_STACK_ENTRIES;
        const trimmed = stack.slice(start);
        const adjustedIndex = Math.max(0, index - start);
        return { stack: trimmed, index: adjustedIndex };
      };
      const runWhenReady = (fn) => {
        if (document.readyState === "complete" || document.readyState === "interactive") {
          fn();
        } else {
          window.addEventListener("DOMContentLoaded", fn, { once: true });
        }
      };
      let featureActive = false;
      let isRestoring = false;
      let restoreScheduled = false;
      const ensureCurrentTracked = () => {
        if (!featureActive) {
          return;
        }
        const stored = readStored();
        const current = normalize();
        if (!current) {
          return;
        }
        if (stored.stack.length === 0) {
          stored.stack.push(current);
          stored.index = 0;
          writeStored(stored.stack, stored.index);
          return;
        }
        if (stored.index < 0 || stored.index >= stored.stack.length) {
          stored.index = stored.stack.length - 1;
        }
        if (stored.stack[stored.index] !== current) {
          stored.stack[stored.index] = current;
          writeStored(stored.stack, stored.index);
        }
      };
      const record = (url, replace) => {
        if (!featureActive || isRestoring) {
          return;
        }
        const normalized = normalize(url);
        if (!normalized) {
          return;
        }
        let { stack, index } = readStored();
        if (stack.length === 0) {
          stack.push(normalized);
          index = stack.length - 1;
        } else if (replace) {
          if (index < 0 || index >= stack.length) {
            index = stack.length - 1;
          }
          stack[index] = normalized;
        } else {
          if (index >= stack.length - 1) {
            stack.push(normalized);
            index = stack.length - 1;
          } else {
            stack = stack.slice(0, index + 1);
            stack.push(normalized);
            index = stack.length - 1;
          }
        }
        ({ stack, index } = trimStack(stack, index));
        writeStored(stack, index);
      };
      const restoreHistory = () => {
        if (!featureActive || isRestoring) {
          return;
        }
        const stored = readStored();
        if (stored.stack.length === 0) {
          ensureCurrentTracked();
          return;
        }
        const targetIndex = stored.index >= 0 && stored.index < stored.stack.length ? stored.index : stored.stack.length - 1;
        const normalizedCurrent = normalize();
        if (stored.stack.length === 1 && normalizedCurrent === stored.stack[0]) {
          return;
        }
        const firstEntry = stored.stack[0];
        if (!firstEntry) {
          return;
        }
        isRestoring = true;
        try {
          history.replaceState(history.state, document.title, firstEntry);
          for (let i = 1; i < stored.stack.length; i += 1) {
            history.pushState(history.state, document.title, stored.stack[i]);
          }
        } catch (err) {
          isRestoring = false;
          return;
        }
        isRestoring = false;
        const currentIndex = stored.stack.length - 1;
        const offset = targetIndex - currentIndex;
        if (offset !== 0) {
          history.go(offset);
        } else {
          history.replaceState(history.state, document.title, stored.stack[targetIndex]);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      };
      const scheduleRestore = () => {
        if (!featureActive || restoreScheduled) {
          return;
        }
        restoreScheduled = true;
        runWhenReady(() => {
          restoreScheduled = false;
          restoreHistory();
        });
      };
      let originalPushState = null;
      let originalReplaceState = null;
      const popstateHandler = () => {
        if (!featureActive || isRestoring) {
          return;
        }
        const normalized = normalize();
        if (!normalized) {
          return;
        }
        const stored = readStored();
        const idx = stored.stack.lastIndexOf(normalized);
        if (idx >= 0) {
          stored.index = idx;
        } else {
          stored.stack.push(normalized);
          stored.index = stored.stack.length - 1;
        }
        const trimmed = trimStack(stored.stack, stored.index);
        writeStored(trimmed.stack, trimmed.index);
      };
      const patchHistory = () => {
        if (originalPushState && originalReplaceState) {
          return;
        }
        originalPushState = history.pushState;
        originalReplaceState = history.replaceState;
        history.pushState = function pushStatePatched(state, title, url) {
          const result = originalPushState === null || originalPushState === void 0 ? void 0 : originalPushState.call(history, state, title, url);
          record(url, false);
          return result;
        };
        history.replaceState = function replaceStatePatched(state, title, url) {
          const result = originalReplaceState === null || originalReplaceState === void 0 ? void 0 : originalReplaceState.call(history, state, title, url);
          record(url, true);
          return result;
        };
        window.addEventListener("popstate", popstateHandler);
      };
      const unpatchHistory = () => {
        if (originalPushState) {
          history.pushState = originalPushState;
          originalPushState = null;
        }
        if (originalReplaceState) {
          history.replaceState = originalReplaceState;
          originalReplaceState = null;
        }
        window.removeEventListener("popstate", popstateHandler);
      };
      const setFeatureActive = (enabled) => {
        if (featureActive === enabled) {
          if (featureActive) {
            ensureCurrentTracked();
            scheduleRestore();
          }
          return;
        }
        featureActive = enabled;
        if (featureActive) {
          patchHistory();
          ensureCurrentTracked();
          scheduleRestore();
        } else {
          unpatchHistory();
          clearStored();
        }
      };
      window.addEventListener("CapacitorUpdaterKeepUrlPathAfterReload", (event) => {
        var _a;
        const evt = event;
        const enabled = (_a = evt === null || evt === void 0 ? void 0 : evt.detail) === null || _a === void 0 ? void 0 : _a.enabled;
        if (typeof enabled === "boolean") {
          win.__capgoKeepUrlPathAfterReload = enabled;
          setFeatureActive(enabled);
        } else {
          win.__capgoKeepUrlPathAfterReload = true;
          setFeatureActive(true);
        }
      });
      setFeatureActive(isFeatureConfigured());
    }
  }

  // node_modules/@capgo/capacitor-updater/dist/esm/index.js
  init_definitions2();
  var CapacitorUpdater = registerPlugin("CapacitorUpdater", {
    web: () => Promise.resolve().then(() => (init_web7(), web_exports7)).then((m) => new m.CapacitorUpdaterWeb())
  });

  // src/native.js
  window.Native = {
    Capacitor,
    Preferences,
    LocalNotifications,
    Geolocation: Geolocation2,
    Filesystem,
    CapApp: App,
    SplashScreen,
    CapacitorUpdater
  };
  window.dispatchEvent(new Event("native-ready"));
})();
/*! Bundled license information:

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
