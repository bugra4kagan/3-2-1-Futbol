package com.futbol321.challenge;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.integrity.IntegrityManager;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.IntegrityTokenRequest;

/**
 * Google Play Integrity API / Firebase App Check hazır köprüsü.
 * Not: Firebase Console'da App Check enforcement henüz açılmadığı için
 * cloudProjectNumber yapılandırılmadığında veya Play Services hazır değilse
 * istemci akışını kesmeden yapılandırılmış durum döner.
 */
@CapacitorPlugin(name = "PlayIntegrity")
public class PlayIntegrityPlugin extends Plugin {

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("platform", "android");
        ret.put("sdkVersion", "1.4.0");
        ret.put("enforcementEnabled", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIntegrityToken(PluginCall call) {
        String nonce = call.getString("nonce", "");
        String projectNumberRaw = call.getString("cloudProjectNumber", "");

        if (nonce == null || nonce.trim().isEmpty()) {
            call.reject("MISSING_NONCE");
            return;
        }

        Long cloudProjectNumber = null;
        if (projectNumberRaw != null && !projectNumberRaw.trim().isEmpty()) {
            try {
                cloudProjectNumber = Long.parseLong(projectNumberRaw.trim());
            } catch (NumberFormatException ignored) {
                cloudProjectNumber = null;
            }
        }

        try {
            IntegrityManager manager = IntegrityManagerFactory.create(getContext());
            IntegrityTokenRequest.Builder builder = IntegrityTokenRequest.builder().setNonce(nonce);
            if (cloudProjectNumber != null && cloudProjectNumber > 0) {
                builder.setCloudProjectNumber(cloudProjectNumber);
            }

            manager.requestIntegrityToken(builder.build())
                .addOnSuccessListener(response -> {
                    JSObject res = new JSObject();
                    res.put("ok", true);
                    res.put("token", response.token());
                    call.resolve(res);
                })
                .addOnFailureListener(err -> {
                    JSObject res = new JSObject();
                    res.put("ok", false);
                    res.put("error", err.getMessage() != null ? err.getMessage() : "INTEGRITY_FAILED");
                    call.resolve(res);
                });
        } catch (Throwable err) {
            JSObject res = new JSObject();
            res.put("ok", false);
            res.put("error", err.getMessage() != null ? err.getMessage() : "INTEGRITY_UNAVAILABLE");
            call.resolve(res);
        }
    }
}
