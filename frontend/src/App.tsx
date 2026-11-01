import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { GuestOnlyRoute, ProtectedRoute } from './auth/ProtectedRoute'
import { DashboardPage } from './pages/DashboardPage'
import { ErrorPage } from './pages/ErrorPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<GuestOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
          {/* Example of a role-restricted section:
          <Route element={<ProtectedRoute roles={['employer']} />}>
            <Route path="/employer/vacancies" element={<EmployerVacancies />} />
          </Route> */}

          {/* Until the public vacancy catalog exists, "/" goes to the dashboard. */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<ErrorPage code={404} />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
