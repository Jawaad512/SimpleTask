import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './index.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import { queryClient } from './lib/queryClient'
import { LayoutProvider } from './ui/Layout'
import { ToastProvider } from './ui/Toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <LayoutProvider>
            <App />
          </LayoutProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
