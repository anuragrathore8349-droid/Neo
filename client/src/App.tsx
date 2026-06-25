import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { UserProvider } from './context/UserContext';
import { PlanProvider } from './context/PlanContext';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import VerifyEmail from './pages/Auth/VerifyEmail';
import TwoFactorAuth from './pages/Auth/TwoFactorAuth';
import PlanSelection from './pages/Auth/PlanSelection';
import SubscriptionSuccess from './pages/Auth/SubscriptionSuccess';
import SubscriptionCancelled from './pages/Auth/SubscriptionCancelled';
import Dashboard from './pages/Dashboard';
import Portfolio from './pages/Portfolio';
import Trading from './pages/Trading/index.tsx';
import Wallet from './pages/wallet/Wallet.tsx';
import DeFiOverview from './pages/DeFi/Overview.tsx';
import AIInsights from './pages/AIInsights/AIInsights.tsx';
import LearningCenter from './pages/Learning/LearningCenter.tsx';
import SecurityCenter from './pages/Security/SecurityCenter.tsx';
import Settings from './pages/Settings/index.tsx';
import ProfilePage from './pages/profile/ProfilePage.tsx';
import Analytics from './pages/Analytics';
import Notifications from './pages/Notifications';
import Markets from './pages/Markets/index.tsx';

// Components
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
};

const MainLayout: React.FC<{ sidebarOpen: boolean; toggleSidebar: () => void }> = ({ sidebarOpen, toggleSidebar }) => (
  <div className="min-h-screen bg-dark-900 text-light">
    <Header toggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
    <div className="flex">
      <Sidebar />
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        <main className="p-6 pt-24">
          <Outlet />
        </main>
      </div>
    </div>
  </div>
);

function AppRoutes() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/verify-email/:token" element={<VerifyEmail />} />
      <Route path="/two-factor" element={<TwoFactorAuth />} />
      <Route path="/select-plan" element={<ProtectedRoute><PlanSelection /></ProtectedRoute>} />
      <Route path="/subscription-success" element={<ProtectedRoute><SubscriptionSuccess /></ProtectedRoute>} />
      <Route path="/subscription-cancelled" element={<ProtectedRoute><SubscriptionCancelled /></ProtectedRoute>} />

      <Route element={<MainLayout sidebarOpen={sidebarOpen} toggleSidebar={toggleSidebar} />}>
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
        <Route path="/trading" element={<ProtectedRoute><Trading /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
        <Route path="/defi" element={<ProtectedRoute><DeFiOverview /></ProtectedRoute>} />
        <Route path="/ai-insights" element={<ProtectedRoute><AIInsights /></ProtectedRoute>} />
        <Route path="/learning" element={<ProtectedRoute><LearningCenter /></ProtectedRoute>} />
        <Route path="/security" element={<ProtectedRoute><SecurityCenter /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        {/* NEW Markets page */}
        <Route path="/markets" element={<ProtectedRoute><Markets /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <UserProvider>
      <Router>
        <AuthProvider>
          <PlanProvider>
            <AppRoutes />
            <ToastContainer
              position="top-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="dark"
            />
          </PlanProvider>
        </AuthProvider>
      </Router>
    </UserProvider>
  );
}

export default App;
