import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Helper to convert URL-safe base64 to ArrayBuffer for VAPID key
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check subscription status when user logs in
  useEffect(() => {
    if (!isSupported || !user) return;

    const checkSubscription = async () => {
      try {
      const registration = await navigator.serviceWorker.ready as any;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error('Error checking push subscription:', error);
      }
    };

    checkSubscription();
  }, [isSupported, user]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in your browser');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !user) {
      toast.error('Please sign in to enable notifications');
      return false;
    }

    setIsLoading(true);
    
    try {
      // Request permission first
      const hasPermission = permission === 'granted' || await requestPermission();
      if (!hasPermission) {
        toast.error('Please allow notifications to receive order updates');
        setIsLoading(false);
        return false;
      }

      // Register or get service worker
      const registration = await navigator.serviceWorker.ready as any;

      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Get VAPID public key from server (we'll store it in store_settings)
        const { data: vapidSetting } = await supabase
          .from('store_settings')
          .select('value')
          .eq('key', 'vapid_public_key')
          .maybeSingle();

        if (!vapidSetting?.value) {
          // If no VAPID key, show message that push is not configured
          toast.info('Push notifications are being set up. Please try again later.');
          setIsLoading(false);
          return false;
        }

        const vapidPublicKey = vapidSetting.value as string;

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      // Store subscription in database using any type to bypass generated types
      const subscriptionJSON = subscription.toJSON();
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscriptionJSON.endpoint!,
        keys: {
          p256dh: subscriptionJSON.keys!.p256dh,
          auth: subscriptionJSON.keys!.auth,
        },
      };

      // Use type assertion to bypass TypeScript strict checking for new table
      const client = supabase as any;
      const { error } = await client
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscriptionData.endpoint,
          p256dh: subscriptionData.keys.p256dh,
          auth: subscriptionData.keys.auth,
        }, { onConflict: 'user_id,endpoint' });

      if (error) throw error;

      setIsSubscribed(true);
      toast.success('Push notifications enabled!');
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast.error('Failed to enable push notifications');
      setIsLoading(false);
      return false;
    }
  }, [isSupported, user, permission, requestPermission]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !user) return false;

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready as any;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Remove from database
        const client = supabase as any;
        await client
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);

        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      toast.success('Push notifications disabled');
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      toast.error('Failed to disable push notifications');
      setIsLoading(false);
      return false;
    }
  }, [isSupported, user]);

  const toggleSubscription = useCallback(async () => {
    if (isSubscribed) {
      return unsubscribe();
    } else {
      return subscribe();
    }
  }, [isSubscribed, subscribe, unsubscribe]);

  return {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    subscribe,
    unsubscribe,
    toggleSubscription,
    requestPermission,
  };
}
