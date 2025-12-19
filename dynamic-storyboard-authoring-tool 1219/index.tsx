
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root element not found");

const root = ReactDOM.createRoot(rootElement);
root.render(
  // react-beautiful-dnd has issues with React 18 Strict Mode, removing wrapper for smoother DnD in this specific case
  // as per common workaround for legacy dnd libraries in React 18.
  <App />
);
