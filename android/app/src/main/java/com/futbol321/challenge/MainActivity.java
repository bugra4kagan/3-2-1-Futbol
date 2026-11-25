package com.futbol321.challenge;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayBillingPlugin.class);
        registerPlugin(PlayIntegrityPlugin.class);
        super.onCreate(savedInstanceState);

        // Telefonları dikey (portrait) koru; 600dp ve üzeri tabletlerde yatay & dikey desteği aç
        int smallestWidthDp = getResources().getConfiguration().smallestScreenWidthDp;
        if (smallestWidthDp >= 600) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_FULL_USER);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }

        // Android 15+ (targetSdk 36) edge-to-edge ortamında IME klavye ve sistem çubuğu boşluklarını tek kaynaktan uygula
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (view, windowInsets) -> {
                Insets systemAndIme = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                        | WindowInsetsCompat.Type.ime()
                        | WindowInsetsCompat.Type.displayCutout()
                );
                view.setPadding(
                    systemAndIme.left,
                    systemAndIme.top,
                    systemAndIme.right,
                    systemAndIme.bottom
                );
                return windowInsets;
            });
            ViewCompat.requestApplyInsets(contentView);
        }
    }
}
