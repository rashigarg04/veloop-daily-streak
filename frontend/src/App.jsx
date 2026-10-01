import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import DailyStreakPage from "./pages/DailyStreak/DailyStreakPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/daily-streak"
            element={
              <ProtectedRoute>
                <DailyStreakPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/daily-streak" replace />} />
          <Route path="*" element={<Navigate to="/daily-streak" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}