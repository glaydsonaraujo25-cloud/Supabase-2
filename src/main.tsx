import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ChampionshipAppV3 from './ChampionshipAppV3'
import './championship-app.css'
import './multiuser.css'
import './participant-admin.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChampionshipAppV3 />
  </StrictMode>,
)
