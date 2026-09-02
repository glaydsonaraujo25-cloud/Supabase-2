import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ChampionshipAppV4 from './ChampionshipAppV4'
import PublicChampionship from './PublicChampionship'
import './championship-app.css'
import './multiuser.css'
import './participant-admin.css'
import './public-sharing.css'

const publicSlug = new URLSearchParams(location.search).get('public')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {publicSlug ? <PublicChampionship slug={publicSlug} /> : <ChampionshipAppV4 />}
  </StrictMode>,
)
