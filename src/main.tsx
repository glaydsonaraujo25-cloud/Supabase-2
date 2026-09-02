import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AdminToolkit from './AdminToolkit'
import './styles.css'
import './enhancements.css'
import './admin-toolkit.css'
import './serviceAdminEnhancements'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <>
      <App />
      <AdminToolkit />
    </>
  </StrictMode>,
)
