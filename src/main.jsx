import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <App />
        <Toaster position="top-right" toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid rgba(57, 255, 20, 0.2)',
          },
          success: { iconTheme: { primary: '#39FF14', secondary: '#000' } },
          error: { iconTheme: { primary: '#ff4444', secondary: '#fff' } },
        }} />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)

