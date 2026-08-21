/**
 * يجمع كل إضافات Capacitor المستخدمة في التطبيق في كائن واحد على window.Native
 * ويتم تجميعه (bundle) عبر esbuild إلى www/js/native-bundle.js لأن التطبيق
 * لا يستخدم أي أداة بناء (bundler) أخرى — الصفحات كلها HTML/CSS/JS عادية.
 */
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Geolocation } from "@capacitor/geolocation";
import { Filesystem } from "@capacitor/filesystem";
import { App as CapApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { CapacitorUpdater } from "@capgo/capacitor-updater";

window.Native = {
  Capacitor,
  Preferences,
  LocalNotifications,
  Geolocation,
  Filesystem,
  CapApp,
  SplashScreen,
  CapacitorUpdater,
};

window.dispatchEvent(new Event("native-ready"));
