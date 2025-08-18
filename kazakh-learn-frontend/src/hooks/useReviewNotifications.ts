import { useState, useEffect } from 'react';
import { learningAPI } from '../services/learningAPI';
import { toast } from 'react-hot-toast';

interface ReviewNotification {
  due_now: number;
  due_today: number;
  overdue: number;
  last_checked: Date;
}

export const useReviewNotifications = (intervalMinutes: number = 30) => {
  const [notifications, setNotifications] = useState<ReviewNotification | null>(null);
  const [lastNotification, setLastNotification] = useState<Date | null>(null);

  useEffect(() => {
    const checkReviews = async () => {
      try {
        const stats = await learningAPI.getReviewStats();
        const now = new Date();
        
        setNotifications({
          ...stats,
          last_checked: now
        });

        // Show notification if there are overdue reviews and we haven't notified recently
        if (stats.overdue > 0 && (!lastNotification || 
            (now.getTime() - lastNotification.getTime()) > (intervalMinutes * 60 * 1000))) {
          
          toast(
            `You have ${stats.overdue} overdue reviews!`,
            {
              icon: '📚',
              duration: 5000,
              style: {
                background: '#fed7aa',
                color: '#9a3412',
              },
            }
          );
          
          setLastNotification(now);
        }
      } catch (error) {
        console.error('Failed to check review notifications:', error);
      }
    };

    // Check immediately
    checkReviews();

    // Set up interval
    const interval = setInterval(checkReviews, intervalMinutes * 60 * 1000);

    return () => clearInterval(interval);
  }, [intervalMinutes, lastNotification]);

  return {
    notifications,
    hasOverdue: notifications ? notifications.overdue > 0 : false,
    hasDueToday: notifications ? notifications.due_today > 0 : false,
    totalDue: notifications ? (notifications.due_now + notifications.due_today + notifications.overdue) : 0
  };
};
