import { messaging, db } from './firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';

export const setupFCM = async (userId: string, onNotification: (notification: { title: string; body: string }) => void) => {
  if (!messaging) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging);
      if (token) {
        await setDoc(doc(db, 'users', userId, 'fcmTokens', token), {
          userId,
          token,
          updatedAt: new Date().toISOString()
        });
        console.log('FCM token stored');
      }
    }
  } catch (error) {
    console.error('Error setting up FCM:', error);
  }

  if (messaging) {
    onMessage(messaging, (payload) => {
      onNotification({
        title: payload.notification?.title || 'New Notification',
        body: payload.notification?.body || ''
      });
    });
  }
};
