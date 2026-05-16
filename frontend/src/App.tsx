import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import MeetingRoomPage from './features/meeting/MeetingRoomPage';
import ChatPage from './features/chat/ChatPage';
import React from 'react';
import { SettingsProvider } from './contexts/SettingsContext';
import { ChatSocketProvider } from './features/chat/context/ChatSocketContext';
import { ThemeProvider } from './contexts/ThemeProvider';

function ProtectedRoute({ children }: { children: any }) {
  const { user } = useAuth();
  return user?.id ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();
  return (
    <ThemeProvider>
      <SettingsProvider>
        <ChatSocketProvider>
          <Routes>
            {!user?.id && (
              <React.Fragment>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </React.Fragment>
            )}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/meeting/:meetingCode"
              element={
                <ProtectedRoute>
                  <MeetingRoomPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:conversationId?"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ChatSocketProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
