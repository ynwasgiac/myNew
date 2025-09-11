// src/hooks/useHeartbeat.ts
import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 минут
const ACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 минут без активности

export const useHeartbeat = () => {
  const { isAuthenticated, logout } = useAuth();
  const lastActivityRef = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef<boolean>(true);

  // Отслеживание активности пользователя
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      isActiveRef.current = true;
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
    };
  }, []);

  // Heartbeat функция
  const sendHeartbeat = async () => {
    const now = Date.now();
    const timeSinceActivity = now - lastActivityRef.current;

    // Если пользователь неактивен больше ACTIVITY_TIMEOUT, не отправляем heartbeat
    if (timeSinceActivity > ACTIVITY_TIMEOUT) {
      console.log('User inactive, skipping heartbeat');
      isActiveRef.current = false;
      return;
    }

    try {
      console.log('Sending heartbeat...');
      await api.post('/auth/heartbeat');
      console.log('Heartbeat sent successfully');
      isActiveRef.current = true;
    } catch (error: any) {
      console.error('Heartbeat failed:', error);
      
      // Если получили 401, пользователь разлогинен
      if (error?.response?.status === 401) {
        console.log('Session expired, logging out...');
        logout();
      }
    }
  };

  // Установка интервала heartbeat
  useEffect(() => {
    if (isAuthenticated) {
      console.log('Starting heartbeat...');
      
      // Отправляем первый heartbeat сразу
      sendHeartbeat();
      
      // Устанавливаем интервал
      heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    } else {
      console.log('Stopping heartbeat...');
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [isAuthenticated]);

  return {
    isActive: isActiveRef.current,
    sendHeartbeat
  };
};