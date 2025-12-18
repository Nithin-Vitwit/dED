import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import Navigation from './components/Navigation';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Marketplace from './pages/Marketplace';
import UploadCourse from './pages/UploadCourse';
import CourseView from './pages/CourseView';
import MyUploads from './pages/MyUploads';
import MyPurchases from './pages/MyPurchases';
import useWalletStorageCleanup from './hooks/useWalletStorageCleanup';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { connected } = useWallet();
  const location = useLocation();

  if (!connected) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// App Content (inside BrowserRouter)
function AppContent() {
  const { connected } = useWallet();

  // Automatically clean localStorage when wallet disconnects
  useWalletStorageCleanup();

  return (
    <>
      {connected && <Navigation />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/marketplace" element={
          <ProtectedRoute>
            <Marketplace />
          </ProtectedRoute>
        } />
        <Route path="/upload" element={
          <ProtectedRoute>
            <UploadCourse />
          </ProtectedRoute>
        } />
        <Route path="/course/:id" element={
          <ProtectedRoute>
            <CourseView />
          </ProtectedRoute>
        } />
        <Route path="/my-uploads" element={
          <ProtectedRoute>
            <MyUploads />
          </ProtectedRoute>
        } />
        <Route path="/my-purchases" element={
          <ProtectedRoute>
            <MyPurchases />
          </ProtectedRoute>
        } />
        {/* Catch-all: redirect to login if not connected, home if connected */}
        <Route path="*" element={<Navigate to={connected ? "/" : "/login"} replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
