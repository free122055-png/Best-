import os

# 1. Update android/app/src/main/res/values/colors.xml
colors_xml_path = 'android/app/src/main/res/values/colors.xml'
colors_xml_content = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#005a36</color>
    <color name="colorPrimaryDark">#004429</color>
    <color name="colorAccent">#005a36</color>
    <color name="statusBarColor">#005a36</color>
    <color name="navigationBarColor">#005a36</color>
    <color name="ic_launcher_background">#005a36</color>
</resources>
"""
os.makedirs(os.path.dirname(colors_xml_path), exist_ok=True)
with open(colors_xml_path, 'w') as f:
    f.write(colors_xml_content.strip())
print(f"Updated {colors_xml_path}")


# 2. Update android/app/src/main/res/values/styles.xml
styles_xml_path = 'android/app/src/main/res/values/styles.xml'
styles_xml_content = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Base application theme. -->
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:windowBackground">#005a36</item>
        <item name="android:background">#005a36</item>
        <item name="android:statusBarColor">@color/statusBarColor</item>
        <item name="android:navigationBarColor">@color/navigationBarColor</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:windowBackground">@drawable/splash</item>
        <item name="android:background">@drawable/splash</item>
        <item name="android:statusBarColor">@color/statusBarColor</item>
        <item name="android:navigationBarColor">@color/navigationBarColor</item>
    </style>
</resources>
"""
with open(styles_xml_path, 'w') as f:
    f.write(styles_xml_content.strip())
print(f"Updated {styles_xml_path}")


# 3. Create android/app/src/main/res/values-v35/styles.xml (Android 15 Target SDK 35+)
styles_v35_path = 'android/app/src/main/res/values-v35/styles.xml'
styles_v35_content = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:windowBackground">#005a36</item>
        <item name="android:background">#005a36</item>
        <item name="android:statusBarColor">@color/statusBarColor</item>
        <item name="android:navigationBarColor">@color/navigationBarColor</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowLightNavigationBar">false</item>
        <item name="android:enforceNavigationBarContrast">false</item>
        <item name="android:enforceStatusBarContrast">false</item>
    </style>
</resources>
"""
os.makedirs(os.path.dirname(styles_v35_path), exist_ok=True)
with open(styles_v35_path, 'w') as f:
    f.write(styles_v35_content.strip())
print(f"Created {styles_v35_path}")


# 4. Update MainActivity.java
main_activity_path = 'android/app/src/main/java/com/bnb/business/network/MainActivity.java'
main_activity_content = """package com.bnb.business.network;

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
        registerPlugin(SmsReceiverPlugin.class);
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
"""
with open(main_activity_path, 'w') as f:
    f.write(main_activity_content.strip())
print(f"Updated {main_activity_path}")


# 5. Update capacitor.config.json
cap_config_path = 'capacitor.config.json'
if os.path.exists(cap_config_path):
    with open(cap_config_path, 'r') as f:
        import json
        cap_data = json.load(f)

    if 'plugins' not in cap_data:
        cap_data['plugins'] = {}

    cap_data['plugins']['StatusBar'] = {
        "style": "DARK",
        "backgroundColor": "#005a36",
        "overlaysWebView": false
    }
    cap_data['plugins']['NavigationBar'] = {
        "backgroundColor": "#005a36",
        "style": "DARK"
    }
    cap_data['plugins']['SplashScreen'] = {
        "launchShowDuration": 1200,
        "launchAutoHide": True,
        "backgroundColor": "#005a36",
        "androidSplashResourceName": "splash",
        "androidScaleType": "CENTER_INSIDE",
        "showSpinner": False,
        "splashFullScreen": True,
        "splashImmersive": True
    }

    with open(cap_config_path, 'w') as f:
        json.dump(cap_data, f, indent=2)
    print(f"Updated {cap_config_path}")


# 6. Update index.html
index_html_path = 'index.html'
if os.path.exists(index_html_path):
    with open(index_html_path, 'r') as f:
        html_code = f.read()

    html_code = html_code.replace('<meta name="theme-color" content="#ffffff" />', '<meta name="theme-color" content="#005a36" />')
    html_code = html_code.replace('<html lang="bn" style="background-color: #ffffff; height: 100%;">', '<html lang="bn" style="background-color: #005a36; height: 100%;">')

    with open(index_html_path, 'w') as f:
        f.write(html_code)
    print(f"Updated {index_html_path}")


# 7. Update src/index.css
index_css_path = 'src/index.css'
if os.path.exists(index_css_path):
    with open(index_css_path, 'r') as f:
        css_code = f.read()

    if 'env(safe-area-inset' not in css_code:
        css_addition = """
/* Native Safe Area Insets and Android System Bars Background Sync */
:root {
  --sat: env(safe-area-inset-top, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
}

html, body {
  background-color: #005a36 !important;
}
"""
        css_code += css_addition
        with open(index_css_path, 'w') as f:
            f.write(css_code)
        print(f"Updated {index_css_path}")

print("All Android System Bar configurations applied successfully!")
