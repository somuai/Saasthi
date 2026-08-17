import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Patients } from "./pages/Patients";
import { PatientDetail } from "./pages/PatientDetailView";
import { Ashas } from "./pages/Ashas";
import { Flags } from "./pages/Flags";
import { Referrals } from "./pages/Referrals";
import { Incentives } from "./pages/Incentives";
import { Admin } from "./pages/Admin";
import { Reports } from "./pages/Reports";
import { Maternal } from "./pages/Maternal";
import { DoctorDashboard } from "./pages/DoctorDashboard";
import { GodView } from "./pages/GodView";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ErrorBoundary>
              <Layout />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="patients" element={<Patients />} />
        <Route path="patients/:id" element={<PatientDetail />} />
        <Route path="ashas" element={<Ashas />} />
        <Route path="flags" element={<Flags />} />
        <Route path="referrals" element={<Referrals />} />
        <Route path="incentives" element={<Incentives />} />
        <Route path="admin" element={<Admin />} />
        <Route path="reports" element={<Reports />} />
        <Route path="maternal" element={<Maternal />} />
        <Route path="doctor/dashboard" element={<DoctorDashboard />} />
        <Route path="god-view" element={<GodView />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

