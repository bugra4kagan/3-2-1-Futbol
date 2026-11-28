package com.futbol321.challenge;

import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.View;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int STADIUM_GREEN_BG = Color.parseColor("#0D3822");

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayBillingPlugin.class);
        registerPlugin(PlayIntegrityPlugin.class);
        registerPlugin(GoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);

        getWindow().setBackgroundDrawable(new ColorDrawable(STADIUM_GREEN_BG));
        getWindow().getDecorView().setBackgroundColor(STADIUM_GREEN_BG);
        WindowInsetsControllerCompat insetsController =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(false);
            insetsController.setAppearanceLightNavigationBars(false);
        }

        // Telefon ve tabletlerde daima dikey (portrait) oyun deneyimi uygula
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

        // Capacitor 8 SystemBars eklentisi DecorView uzerinde systemBars + IME (klavye) boslugunu tek seferde uygular.
        // android.R.id.content uzerinde ikinci bir IME padding dinleyicisi eklenmez (cift klavye boslugunu onler).
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(STADIUM_GREEN_BG);
            contentView.setPadding(0, 0, 0, 0);
        }
    }
}
