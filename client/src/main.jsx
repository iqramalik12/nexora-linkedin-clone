import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { CountsProvider } from './lib/counts.jsx';
import { ToastProvider } from './lib/toast.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CountsProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </CountsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
