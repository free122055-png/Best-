package com.bnb.business.network;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Native Android Status Bar & System Navigation Bar setup
        setupDarkGreenSystemBars();
    }

    private void setupDarkGreenSystemBars() {
        try {
            Window window = getWindow();
            if (window == null) return;

            // Ensure window enables status bar & navigation bar drawing
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);

            int darkGreenColor = Color.parseColor("#005a36");
            window.setStatusBarColor(darkGreenColor);
            window.setNavigationBarColor(darkGreenColor);

            // Icon & Navigation Bar Handle Contrast Management
            WindowInsetsControllerCompat insetsController = 
                WindowCompat.getInsetsController(window, window.getDecorView());
            
            if (insetsController != null) {
                // false = Crisp White time, battery, wifi icons & white gesture handle / 3-buttons
                insetsController.setAppearanceLightStatusBars(false);
                insetsController.setAppearanceLightNavigationBars(false);
            }

            // Android 15+ (API 35+) Enforce Contrast Override to prevent gray overlay on navigation bar
            if (Build.VERSION.SDK_INT >= 35) {
                try {
                    window.getClass().getMethod("setEnforceNavigationBarContrast", boolean.class)
                        .invoke(window, false);
                    window.getClass().getMethod("setEnforceStatusBarContrast", boolean.class)
                        .invoke(window, false);
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}