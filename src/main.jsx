import React from 'react';
import { createRoot } from 'react-dom/client';
import './hooks/useInstallPrompt.js'; // ловим beforeinstallprompt как можно раньше
import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';
import './styles/pages.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
