import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import './styles/global.css';
import './index.css';
import StoreProvider from './redux/StoreProvider';
import { NotificationSocketProvider } from './contexts/NotificationSocketContext';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <StoreProvider>
      <AuthProvider>
        <SocketProvider>
          <NotificationSocketProvider>
            <App />
          </NotificationSocketProvider>
        </SocketProvider>
      </AuthProvider>
    </StoreProvider>
  </BrowserRouter>
);
