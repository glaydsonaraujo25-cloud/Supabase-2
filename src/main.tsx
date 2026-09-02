import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AdminToolkit from './AdminToolkit'
import OperationalCenter from './OperationalCenter'
import AdministrationCenter from './AdministrationCenter'
import './styles.css'
import './enhancements.css'
import './admin-toolkit.css'
import './operational-center.css'
import './administration-center.css'
import './serviceAdminEnhancements'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <>
      <App />
      <AdminToolkit />
      <OperationalCenter />
      <AdministrationCenter />
    </>
  </StrictMode>,
)
