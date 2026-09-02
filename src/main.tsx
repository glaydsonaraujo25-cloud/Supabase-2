import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ChampionshipDashboard from './ChampionshipDashboard'
import PublicChampionship from './PublicChampionship'
import './championship-app.css'
import './multiuser.css'
import './participant-admin.css'
import './public-sharing.css'
import './statistics.css'
import './knockout.css'

const publicSlug = new URLSearchParams(location.search).get('public')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {publicSlug ? <PublicChampionship slug={publicSlug} /> : <ChampionshipDashboard />}
  </StrictMode>,
)
