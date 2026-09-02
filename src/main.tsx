import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ChampionshipAppV2 from './ChampionshipAppV2'
import './championship-app.css'
import './multiuser.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChampionshipAppV2 />
  </StrictMode>,
)
