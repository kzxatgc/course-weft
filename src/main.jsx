import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { preloadSounds } from './audio/optional-sounds.js';
import './app.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  preloadSounds();
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
