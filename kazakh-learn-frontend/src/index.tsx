import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n'; // Import i18n configuration
import App from './App';
import './styles/globals.css'; // If you have global styles

// Add a small delay to ensure i18n is loaded
setTimeout(() => {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}, 100);