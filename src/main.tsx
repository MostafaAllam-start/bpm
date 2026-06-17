import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './i18n'
import './index.css'
import App from './App.tsx'
import LoginPage from './LoginPage.tsx'
import RequireAuth from './auth/RequireAuth.tsx'
import { initAppearance } from './theme/themeMode'

// Apply the stored (or OS-derived) light/dark + accent before the first paint.
initAppearance()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <App />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
