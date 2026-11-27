package com.futbol321.challenge;

import android.app.Activity;
import android.content.Context;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException;
import java.util.concurrent.Executor;

/**
 * Android Jetpack Credential Manager tabanlı yerel Google Sign-In eklentisi.
 * Gömülü WebView OAuth kısıtlamasına (`disallowed_useragent`) takılmadan sistemin
 * resmi Google hesap seçicisiyle ID Token alır; JS katmanı bu tokenı Firebase
 * `GoogleAuthProvider.credential(idToken)` ile oturuma bağlar.
 */
@CapacitorPlugin(name = "GoogleAuth")
public class GoogleAuthPlugin extends Plugin {

    private String resolveServerClientId(PluginCall call) {
        String provided = call.getString("serverClientId", "");
        if (provided != null && !provided.trim().isEmpty()) {
            return provided.trim();
        }
        Context ctx = getContext();
        int resId = ctx.getResources().getIdentifier(
            "default_web_client_id",
            "string",
            ctx.getPackageName()
        );
        if (resId != 0) {
            String fromRes = ctx.getString(resId);
            if (fromRes != null && !fromRes.trim().isEmpty()) {
                return fromRes.trim();
            }
        }
        return "";
    }

    private Executor resolveMainExecutor(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return ctx.getMainExecutor();
        }
        return command -> getActivity().runOnUiThread(command);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", getActivity() != null);
        ret.put("provider", "androidx_credential_manager");
        call.resolve(ret);
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("code", "NO_ACTIVITY");
            err.put("message", "Android etkinlik penceresi hazır değil.");
            call.resolve(err);
            return;
        }

        String serverClientId = resolveServerClientId(call);
        if (serverClientId.isEmpty()) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("code", "MISSING_WEB_CLIENT_ID");
            err.put(
                "message",
                "Google Web Client ID (default_web_client_id) bulunamadı."
            );
            call.resolve(err);
            return;
        }

        try {
            GetSignInWithGoogleOption googleOption =
                new GetSignInWithGoogleOption.Builder(serverClientId).build();

            GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(googleOption)
                .build();

            CredentialManager credentialManager = CredentialManager.create(activity);
            credentialManager.getCredentialAsync(
                activity,
                request,
                null,
                resolveMainExecutor(activity),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(@NonNull GetCredentialResponse result) {
                        Credential credential = result.getCredential();
                        if (credential instanceof CustomCredential
                            && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(
                                credential.getType()
                            )) {
                            try {
                                GoogleIdTokenCredential tokenCred =
                                    GoogleIdTokenCredential.createFrom(credential.getData());
                                String idToken = tokenCred.getIdToken();
                                if (idToken == null || idToken.trim().isEmpty()) {
                                    JSObject bad = new JSObject();
                                    bad.put("ok", false);
                                    bad.put("code", "EMPTY_ID_TOKEN");
                                    bad.put("message", "Google kimlik tokenı alınamadı.");
                                    call.resolve(bad);
                                    return;
                                }
                                JSObject ok = new JSObject();
                                ok.put("ok", true);
                                ok.put("idToken", idToken);
                                ok.put("email", tokenCred.getId());
                                ok.put("displayName", tokenCred.getDisplayName());
                                call.resolve(ok);
                            } catch (GoogleIdTokenParsingException parseEx) {
                                JSObject bad = new JSObject();
                                bad.put("ok", false);
                                bad.put("code", "TOKEN_PARSE_ERROR");
                                bad.put(
                                    "message",
                                    parseEx.getMessage() != null
                                        ? parseEx.getMessage()
                                        : "Google kimlik verisi okunamadı."
                                );
                                call.resolve(bad);
                            }
                            return;
                        }

                        JSObject unexpected = new JSObject();
                        unexpected.put("ok", false);
                        unexpected.put("code", "UNEXPECTED_CREDENTIAL");
                        unexpected.put("message", "Beklenmeyen Google kimlik türü alındı.");
                        call.resolve(unexpected);
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException e) {
                        JSObject err = new JSObject();
                        err.put("ok", false);
                        if (e instanceof GetCredentialCancellationException) {
                            err.put("code", "USER_CANCELED");
                            err.put("message", "popup-closed-by-user");
                        } else if (e instanceof NoCredentialException) {
                            err.put("code", "NO_CREDENTIAL");
                            err.put(
                                "message",
                                e.getMessage() != null && !e.getMessage().isEmpty()
                                    ? e.getMessage()
                                    : "no-google-credential"
                            );
                        } else {
                            err.put("code", e.getType());
                            err.put(
                                "message",
                                e.getMessage() != null ? e.getMessage() : e.getType()
                            );
                        }
                        call.resolve(err);
                    }
                }
            );
        } catch (Throwable ex) {
            JSObject err = new JSObject();
            err.put("ok", false);
            err.put("code", "CREDENTIAL_MANAGER_ERROR");
            err.put("message", ex.getMessage() != null ? ex.getMessage() : "Google Auth hatası");
            call.resolve(err);
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        Activity activity = getActivity();
        Context ctx = activity != null ? activity : getContext();
        if (ctx == null) {
            JSObject ok = new JSObject();
            ok.put("ok", true);
            call.resolve(ok);
            return;
        }
        try {
            CredentialManager credentialManager = CredentialManager.create(ctx);
            credentialManager.clearCredentialStateAsync(
                new ClearCredentialStateRequest(),
                null,
                resolveMainExecutor(ctx),
                new CredentialManagerCallback<Void, ClearCredentialException>() {
                    @Override
                    public void onResult(Void result) {
                        JSObject ok = new JSObject();
                        ok.put("ok", true);
                        call.resolve(ok);
                    }

                    @Override
                    public void onError(@NonNull ClearCredentialException e) {
                        JSObject ok = new JSObject();
                        ok.put("ok", false);
                        ok.put("message", e.getMessage());
                        call.resolve(ok);
                    }
                }
            );
        } catch (Throwable ignored) {
            JSObject ok = new JSObject();
            ok.put("ok", true);
            call.resolve(ok);
        }
    }
}
