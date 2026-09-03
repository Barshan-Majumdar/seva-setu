package com.sevasetu.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * VoiceListenerService — Android Foreground Service
 * 
 * Keeps the Capacitor WebView process alive when the app is in background
 * or the screen is locked, so the JavaScript BackgroundVoiceService can
 * continue listening for the "Seva Setu" wake word.
 * 
 * This service shows a persistent notification to comply with Android's
 * foreground service requirements (Android 8+).
 */
public class VoiceListenerService extends Service {

    private static final String CHANNEL_ID = "sevasetu_voice_channel";
    private static final int NOTIFICATION_ID = 1001;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Acquire partial wake lock to prevent CPU from sleeping
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "SevaSetu::VoiceListenerWakeLock"
            );
            wakeLock.acquire();
        }

        // Build persistent notification
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SevaSetu is listening")
            .setContentText("Say \"Seva Setu\" anytime for emergency help")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();

        startForeground(NOTIFICATION_ID, notification);

        // If the system kills the service, restart it
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Voice Listener",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps SevaSetu listening for your voice commands");
            channel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
