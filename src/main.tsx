import { StrictMode, lazy } from "react";
import { createRoot } from "react-dom/client";
import LoadBoundary from "./LoadBoundary";
const ChampionshipDashboard = lazy(() => import("./ChampionshipDashboard"));
const PublicChampionship = lazy(() => import("./PublicChampionship"));
import "./championship-app.css";
import "./multiuser.css";
import "./public-sharing.css";
import "./management.css";

const publicSlug = new URLSearchParams(location.search).get("public");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LoadBoundary>
      {publicSlug ? (
        <PublicChampionship slug={publicSlug} />
      ) : (
        <ChampionshipDashboard />
      )}
    </LoadBoundary>
  </StrictMode>,
);
