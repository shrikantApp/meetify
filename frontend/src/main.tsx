import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import './index.css';
import StoreProvider from './redux/StoreProvider';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <StoreProvider>
      <AuthProvider>
        <SocketProvider>
          <App />
        </SocketProvider>
      </AuthProvider>
    </StoreProvider>
  </BrowserRouter>
);
