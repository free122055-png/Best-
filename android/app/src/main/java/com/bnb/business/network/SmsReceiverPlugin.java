package com.bnb.business.network;

import android.Manifest;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "SmsReceiverPlugin",
    permissions = {
        @Permission(
            alias = "sms",
            strings = { Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS }
        )
    }
)
public class SmsReceiverPlugin extends Plugin {
    private static SmsReceiverPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void notifyPaymentReceived(String operator, String trxId, String amount, String senderPhone, String message, long timestamp) {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("operator", operator != null ? operator : "bKash");
            data.put("trxId", trxId);
            try {
                data.put("amount", Double.parseDouble(amount));
            } catch (Exception e) {
                data.put("amount", amount);
            }
            data.put("senderPhone", senderPhone);
            data.put("message", message);
            data.put("timestamp", timestamp);
            data.put("sender", operator != null ? operator : "bKash");
            instance.notifyListeners("paymentDetected", data);
            instance.notifyListeners("bKashPaymentDetected", data);
        }
    }

    public static void notifyPaymentReceived(String trxId, String amount, String senderPhone, String message, long timestamp) {
        notifyPaymentReceived("bKash", trxId, amount, senderPhone, message, timestamp);
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        boolean hasReceiveSms = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean hasReadSms = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
        
        JSObject ret = new JSObject();
        ret.put("granted", hasReceiveSms && hasReadSms);
        ret.put("receiveSms", hasReceiveSms);
        ret.put("readSms", hasReadSms);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        requestPermissionForAlias("sms", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        boolean hasReceiveSms = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean hasReadSms = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
        
        JSObject ret = new JSObject();
        ret.put("granted", hasReceiveSms && hasReadSms);
        ret.put("receiveSms", hasReceiveSms);
        ret.put("readSms", hasReadSms);
        call.resolve(ret);
    }

    @PluginMethod
    public void getGatewayStatus(PluginCall call) {
        boolean hasReceiveSms = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        String webhookUrl = getContext().getSharedPreferences(BkashSmsReceiver.PREFS_NAME, android.content.Context.MODE_PRIVATE)
            .getString(BkashSmsReceiver.KEY_WEBHOOK_URL, "https://ais-dev-lcpzj4h5d5mm2it3dw6e57-969303088573.asia-southeast1.run.app/api/sms-gateway/webhook");
        
        JSObject ret = new JSObject();
        ret.put("isNative", true);
        ret.put("smsPermissionGranted", hasReceiveSms);
        ret.put("supportedOperator", "bKash, Nagad, Rocket (Personal & Merchant)");
        ret.put("status", hasReceiveSms ? "ACTIVE_LISTENING" : "PERMISSION_REQUIRED");
        call.resolve(ret);
    }

    @PluginMethod
    public void setWebhookUrl(PluginCall call) {
        String url = call.getString("webhookUrl");
        if (url == null || url.trim().isEmpty()) {
            call.reject("Webhook URL cannot be empty");
            return;
        }
        getContext().getSharedPreferences(BkashSmsReceiver.PREFS_NAME, android.content.Context.MODE_PRIVATE)
            .edit()
            .putString(BkashSmsReceiver.KEY_WEBHOOK_URL, url.trim())
            .apply();
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("webhookUrl", url.trim());
        call.resolve(ret);
    }

    @PluginMethod
    public void getWebhookUrl(PluginCall call) {
        String webhookUrl = getContext().getSharedPreferences(BkashSmsReceiver.PREFS_NAME, android.content.Context.MODE_PRIVATE)
            .getString(BkashSmsReceiver.KEY_WEBHOOK_URL, "https://ais-dev-lcpzj4h5d5mm2it3dw6e57-969303088573.asia-southeast1.run.app/api/sms-gateway/webhook");
        JSObject ret = new JSObject();
        ret.put("webhookUrl", webhookUrl);
        call.resolve(ret);
    }

    @PluginMethod
    public void testSimulateSms(PluginCall call) {
        String trxId = call.getString("trxId", "TEST" + System.currentTimeMillis());
        String amount = call.getString("amount", "100");
        String senderPhone = call.getString("senderPhone", "01700000000");
        String message = call.getString("message", "You have received Tk " + amount + " from " + senderPhone + ". TrxID " + trxId);
        long timestamp = System.currentTimeMillis();

        notifyPaymentReceived(trxId, amount, senderPhone, message, timestamp);
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("trxId", trxId);
        ret.put("amount", amount);
        call.resolve(ret);
    }

    @PluginMethod
    public void syncOfflineQueue(PluginCall call) {
        try {
            BkashSmsReceiver.flushOfflineQueue(getContext());
            android.content.SharedPreferences prefs = getContext().getSharedPreferences(BkashSmsReceiver.PREFS_NAME, android.content.Context.MODE_PRIVATE);
            String queueStr = prefs.getString(BkashSmsReceiver.KEY_OFFLINE_QUEUE, "[]");
            org.json.JSONArray array = new org.json.JSONArray(queueStr);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("pendingOfflineCount", array.length());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to flush offline queue: " + e.getMessage());
        }
    }
}
