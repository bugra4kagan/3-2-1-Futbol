package com.futbol321.challenge;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.appcheck.FirebaseAppCheck;
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory;

/**
 * Gerçek Firebase App Check + Google Play Integrity token üreteci.
 * PlayIntegrityAppCheckProviderFactory aracılığıyla Google Play Integrity onayını
 * Firebase App Check sunucularıyla takas ederek geçerli Firebase App Check JWT token'ı üretir.
 * Not: Firebase Console'da App Check enforcement kapalı olduğu sürece eksik yapılandırma
 * durumunda istemciyi kilitlemez.
 */
@CapacitorPlugin(name = "PlayIntegrity")
public class PlayIntegrityPlugin extends Plugin {

    private static volatile boolean providerInstalled = false;

    private boolean ensureFirebaseApp(String projectId, String apiKey, String androidAppId) {
        if (!FirebaseApp.getApps(getContext()).isEmpty()) {
            return true;
        }
        if (androidAppId == null || androidAppId.trim().isEmpty()
            || apiKey == null || apiKey.trim().isEmpty()
            || projectId == null || projectId.trim().isEmpty()) {
            return false;
        }
        try {
            FirebaseOptions options = new FirebaseOptions.Builder()
                .setProjectId(projectId.trim())
                .setApiKey(apiKey.trim())
                .setApplicationId(androidAppId.trim())
                .build();
            FirebaseApp.initializeApp(getContext(), options);
            return !FirebaseApp.getApps(getContext()).isEmpty();
        } catch (Throwable ignored) {
            return !FirebaseApp.getApps(getContext()).isEmpty();
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        boolean hasGoogleServicesApp = !FirebaseApp.getApps(getContext()).isEmpty();
        JSObject ret = new JSObject();
        ret.put("platform", "android");
        ret.put("sdk", "firebase-appcheck-playintegrity");
        ret.put("hasGoogleServicesApp", hasGoogleServicesApp);
        ret.put("enforcementEnabled", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void getFirebaseAppCheckToken(PluginCall call) {
        boolean forceRefresh = Boolean.TRUE.equals(call.getBoolean("forceRefresh", false));
        String projectId = call.getString("projectId", "");
        String apiKey = call.getString("apiKey", "");
        String androidAppId = call.getString("androidAppId", "");

        if (!ensureFirebaseApp(projectId, apiKey, androidAppId)) {
            JSObject missing = new JSObject();
            missing.put("ok", false);
            missing.put("status", "MISSING_ANDROID_FIREBASE_CONFIG");
            missing.put(
                "error",
                "Android Firebase App Check token üretimi için google-services.json veya VITE_FIREBASE_ANDROID_APP_ID gereklidir."
            );
            call.resolve(missing);
            return;
        }

        try {
            FirebaseAppCheck appCheck = FirebaseAppCheck.getInstance();
            synchronized (PlayIntegrityPlugin.class) {
                if (!providerInstalled) {
                    appCheck.installAppCheckProviderFactory(
                        PlayIntegrityAppCheckProviderFactory.getInstance()
                    );
                    providerInstalled = true;
                }
            }

            appCheck.getAppCheckToken(forceRefresh)
                .addOnSuccessListener(appCheckToken -> {
                    JSObject res = new JSObject();
                    res.put("ok", true);
                    res.put("token", appCheckToken.getToken());
                    res.put("expireTimeMillis", appCheckToken.getExpireTimeMillis());
                    call.resolve(res);
                })
                .addOnFailureListener(err -> {
                    JSObject res = new JSObject();
                    res.put("ok", false);
                    res.put("status", "APPCHECK_TOKEN_FAILED");
                    res.put("error", err.getMessage() != null ? err.getMessage() : "APPCHECK_FAILED");
                    call.resolve(res);
                });
        } catch (Throwable err) {
            JSObject res = new JSObject();
            res.put("ok", false);
            res.put("status", "APPCHECK_UNAVAILABLE");
            res.put("error", err.getMessage() != null ? err.getMessage() : "APPCHECK_ERROR");
            call.resolve(res);
        }
    }
}
