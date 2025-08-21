// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';                        // ✅ App 컴포넌트 import
import './styles.css';                          // ✅ 전역 스타일 import (필요 시)

import { RouteContextProvider } from './context/RouteContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouteContextProvider>
      <App />
    </RouteContextProvider>
  </React.StrictMode>
);
