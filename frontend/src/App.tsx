import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { GuestOnlyRoute, ProtectedRoute } from './auth/ProtectedRoute'
import { CatalogPage } from './pages/CatalogPage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { DashboardPage } from './pages/DashboardPage'
import { ErrorPage } from './pages/ErrorPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { VacancyDetailPage } from './pages/VacancyDetailPage'
import { VacancyFormPage } from './pages/VacancyFormPage'

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

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['employer', 'admin']} />}>
            <Route path="/employer/vacancies/new" element={<VacancyFormPage />} />
            <Route path="/employer/vacancies/:id/edit" element={<VacancyFormPage />} />
          </Route>

          <Route path="/" element={<CatalogPage />} />
          <Route path="/vacancies/:id" element={<VacancyDetailPage />} />
          <Route path="*" element={<ErrorPage code={404} />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
