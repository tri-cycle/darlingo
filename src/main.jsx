import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // 스타일 적용할 거 있으면
import { RouteProvider } from './context/RouteContext'; // 우리가 쓰는 context

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouteProvider>
      <App />
    </RouteProvider>
  </React.StrictMode>
);
