import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ChampionshipApp from './ChampionshipApp'
import './championship-app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChampionshipApp />
  </StrictMode>,
)
