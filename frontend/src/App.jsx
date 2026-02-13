import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import Record from "./components/Record";
import Report from "./components/Report";
import SokoAssistant from "./components/SokoAssistant";
import StockManagement from "./pages/StockManagement";
import DebtTracking from "./pages/DebtTracking";
import Welcome from "./pages/Welcome";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import ResetPassword from "./pages/ResetPassword";
import TermsAndConditions from "./pages/TermsAndConditions";
import Profile from "./pages/Profile";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import FraudDetection from "./pages/admin/FraudDetection";
import UsageAnalytics from "./pages/admin/UsageAnalytics";
import SystemHealth from "./pages/admin/SystemHealth";
import AIMonitoring from "./pages/admin/AIMonitoring";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/reset" element={<ResetPassword />} />
            <Route path="/terms" element={<TermsAndConditions />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/record"
              element={
                <PrivateRoute>
                  <Layout>
                    <Record />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/report"
              element={
                <PrivateRoute>
                  <Layout>
                    <Report />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/assistant"
              element={
                <PrivateRoute>
                  <Layout>
                    <SokoAssistant />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/stock"
              element={
                <PrivateRoute>
                  <Layout>
                    <StockManagement />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/debts"
              element={
                <PrivateRoute>
                  <Layout>
                    <DebtTracking />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="fraud" element={<FraudDetection />} />
              <Route path="analytics" element={<UsageAnalytics />} />
              <Route path="health" element={<SystemHealth />} />
              <Route path="ai" element={<AIMonitoring />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
