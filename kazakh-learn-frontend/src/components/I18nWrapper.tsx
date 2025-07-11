// 3. Create a wrapper component to ensure i18n is ready
// src/components/I18nWrapper.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

interface I18nWrapperProps {
  children: React.ReactNode;
}

const I18nWrapper: React.FC<I18nWrapperProps> = ({ children }) => {
  const { ready } = useTranslation();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkReady = () => {
      if (i18n.isInitialized && ready) {
        setIsReady(true);
        console.log('✅ i18n is ready!');
        console.log('Current language:', i18n.language);
      } else {
        console.log('⏳ Waiting for i18n...');
        setTimeout(checkReady, 100);
      }
    };
    
    checkReady();
  }, [ready]);

  if (!isReady) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading translations...
      </div>
    );
  }

  return <>{children}</>;
};

export default I18nWrapper;