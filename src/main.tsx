import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App';

// PWA: при выходе новой версии Service Worker обновляется и страница
// автоматически перезагружается — без этого телефон может неделями держать
// старый бандл из оффлайн-кэша (кейс «на телефоне 100 блюд, на компе 399»).
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
