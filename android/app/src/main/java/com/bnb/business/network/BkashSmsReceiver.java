package com.bnb.business.network;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class BkashSmsReceiver extends BroadcastReceiver {
    private static final String TAG = "BkashSmsReceiver";
    private static final String DEFAULT_WEBHOOK_URL = "https://ais-dev-lcpzj4h5d5mm2it3dw6e57-969303088573.asia-southeast1.run.app/api/sms-gateway/webhook";
    private static final String GATEWAY_SECRET = "bnb_sms_gateway_secure_2026";
    public static final String PREFS_NAME = "bnb_sms_gateway";
    public static final String KEY_WEBHOOK_URL = "webhook_url";

    // Multi-Operator regex patterns for bKash, Nagad, and Rocket Personal & Merchant Transactions
    private static final Pattern TRX_PATTERN = Pattern.compile("(?:TrxID|trxID|TRXID|Trx\\s*Id|TxnID|TxnId|TXNID|Txn\\s*Id|Transaction\\s*ID|Txn|Trx)[:\\s]*([A-Za-z0-9]{8,15})", Pattern.CASE_INSENSITIVE);
    private static final Pattern AMOUNT_PATTERN = Pattern.compile("(?:(?:received|cash\\s*in|deposit|amount|পরিমাণ)[:\\s]*(?:Tk\\.?|TK\\.?|BDT|৳|টাকা)?|(?:Tk\\.?|TK\\.?|BDT|৳|টাকা))\\s*([0-9,]+(?:\\.[0-9]{1,2})?)", Pattern.CASE_INSENSITIVE);
    private static final Pattern SENDER_PHONE_PATTERN = Pattern.compile("(?:from|by|Sender|প্রেরক|হতে|থেকে)[:\\s]*(\\+?8801[3-9]\\d{8,9}|01[3-9]\\d{8,9})", Pattern.CASE_INSENSITIVE);

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            return;
        }

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null || pdus.length == 0) return;

        String format = bundle.getString("format");
        StringBuilder fullMessage = new StringBuilder();
        String sender = "";
        long timestamp = System.currentTimeMillis();

        for (Object pdu : pdus) {
            SmsMessage message;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                message = SmsMessage.createFromPdu((byte[]) pdu, format);
            } else {
                message = SmsMessage.createFromPdu((byte[]) pdu);
            }
            if (message != null) {
                if (sender.isEmpty()) {
                    sender = message.getDisplayOriginatingAddress();
                    timestamp = message.getTimestampMillis();
                }
                fullMessage.append(message.getDisplayMessageBody());
            }
        }

        String smsText = fullMessage.toString();
        Log.d(TAG, "Incoming SMS from: " + sender);

        // Strict Sender & Content Validation: Accept official bKash (16247), Nagad (16167), and Rocket (16216/DBBL)
        String operator = null;
        String sLower = sender != null ? sender.toLowerCase() : "";
        String msgLower = smsText.toLowerCase();

        if (sLower.contains("bkash") || sLower.contains("16247") || msgLower.contains("bkash") || msgLower.contains("বিকাশ")) {
            operator = "bKash";
        } else if (sLower.contains("nagad") || sLower.contains("16167") || msgLower.contains("nagad") || msgLower.contains("নগদ")) {
            operator = "Nagad";
        } else if (sLower.contains("rocket") || sLower.contains("16216") || sLower.contains("dbbl") || msgLower.contains("rocket") || msgLower.contains("রকেট") || msgLower.contains("dbbl")) {
            operator = "Rocket";
        }

        if (operator == null) {
            // Not a recognized MFS operator SMS
            return;
        }

        // Parse TrxID
        Matcher trxMatcher = TRX_PATTERN.matcher(smsText);
        String trxId = null;
        if (trxMatcher.find()) {
            trxId = trxMatcher.group(1).trim().toUpperCase();
        }

        // Parse Amount
        Matcher amountMatcher = AMOUNT_PATTERN.matcher(smsText);
        String amountStr = null;
        if (amountMatcher.find()) {
            amountStr = amountMatcher.group(1).replace(",", "").trim();
        }

        // Parse Sender Phone
        Matcher phoneMatcher = SENDER_PHONE_PATTERN.matcher(smsText);
        String senderPhone = "";
        if (phoneMatcher.find()) {
            senderPhone = phoneMatcher.group(1).trim();
        }

        if (trxId == null || amountStr == null) {
            Log.w(TAG, operator + " SMS received but TrxID or Amount could not be extracted.");
            return;
        }

        Log.i(TAG, operator + " Payment Detected: TrxID=" + trxId + ", Amount=" + amountStr + ", Phone=" + senderPhone);

        // Notify running Capacitor plugin
        try {
            SmsReceiverPlugin.notifyPaymentReceived(operator, trxId, amountStr, senderPhone, smsText, timestamp);
        } catch (Throwable t) {
            Log.w(TAG, "Could not notify plugin: " + t.getMessage());
        }

        // Post to backend webhook asynchronously
        final String finalOperator = operator;
        final String finalTrxId = trxId;
        final String finalAmount = amountStr;
        final String finalSenderPhone = senderPhone;
        final String finalMessage = smsText;
        final long finalTimestamp = timestamp;

        final Context appContext = context.getApplicationContext();
        new Thread(() -> {
            flushOfflineQueue(appContext);
            sendToBackend(appContext, finalOperator, finalTrxId, finalAmount, finalSenderPhone, finalMessage, finalTimestamp);
        }).start();
    }

    public static final String KEY_OFFLINE_QUEUE = "offline_sms_queue";

    public static boolean sendPayloadDirect(String targetUrl, String jsonPayload) {
        try {
            URL url = new URL(targetUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; utf-8");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonPayload.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int code = conn.getResponseCode();
            Log.i(TAG, "Direct webhook response code: " + code);
            conn.disconnect();
            return (code >= 200 && code < 300);
        } catch (Exception e) {
            Log.e(TAG, "Direct webhook post failed: " + e.getMessage());
            return false;
        }
    }

    public static void flushOfflineQueue(Context context) {
        if (context == null) return;
        try {
            android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String queueStr = prefs.getString(KEY_OFFLINE_QUEUE, "[]");
            org.json.JSONArray array = new org.json.JSONArray(queueStr);
            if (array.length() == 0) return;

            String targetUrl = prefs.getString(KEY_WEBHOOK_URL, DEFAULT_WEBHOOK_URL);
            org.json.JSONArray remaining = new org.json.JSONArray();

            for (int i = 0; i < array.length(); i++) {
                org.json.JSONObject item = array.getJSONObject(i);
                boolean success = sendPayloadDirect(targetUrl, item.toString());
                if (!success) {
                    remaining.put(item);
                }
            }
            prefs.edit().putString(KEY_OFFLINE_QUEUE, remaining.toString()).apply();
            Log.i(TAG, "Flushed offline queue. Remaining unsent: " + remaining.length());
        } catch (Exception e) {
            Log.e(TAG, "Error flushing offline queue: " + e.getMessage());
        }
    }

    private void enqueueOfflineSms(Context context, String payload) {
        if (context == null) return;
        try {
            android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existingQueue = prefs.getString(KEY_OFFLINE_QUEUE, "[]");
            org.json.JSONArray array = new org.json.JSONArray(existingQueue);
            array.put(new org.json.JSONObject(payload));
            prefs.edit().putString(KEY_OFFLINE_QUEUE, array.toString()).apply();
            Log.i(TAG, "Queued offline SMS locally for retry. Queue count: " + array.length());
        } catch (Exception e) {
            Log.e(TAG, "Failed to queue offline SMS: " + e.getMessage());
        }
    }

    private void sendToBackend(Context context, String operator, String trxId, String amount, String senderPhone, String message, long timestamp) {
        String targetUrl = DEFAULT_WEBHOOK_URL;
        if (context != null) {
            targetUrl = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString(KEY_WEBHOOK_URL, DEFAULT_WEBHOOK_URL);
        }

        String jsonPayload = String.format(
            "{\"secretKey\":\"%s\",\"sender\":\"%s\",\"operator\":\"%s\",\"senderPhone\":\"%s\",\"trxId\":\"%s\",\"amount\":%s,\"message\":%s,\"timestamp\":%d,\"source\":\"android_native_receiver\"}",
            GATEWAY_SECRET,
            operator,
            operator,
            senderPhone,
            trxId,
            amount,
            escapeJson(message),
            timestamp
        );

        boolean success = sendPayloadDirect(targetUrl, jsonPayload);
        if (!success) {
            Log.w(TAG, "Network delivery failed. Enqueuing SMS to local storage for automatic retry when network resumes.");
            enqueueOfflineSms(context, jsonPayload);
        }
    }

    private String escapeJson(String s) {
        if (s == null) return "\"\"";
        return "\"" + s.replace("\\", "\\\\")
                       .replace("\"", "\\\"")
                       .replace("\n", "\\n")
                       .replace("\r", "\\r") + "\"";
    }
}
