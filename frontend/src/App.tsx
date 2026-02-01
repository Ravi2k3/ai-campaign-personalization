import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "@/components/theme-provider"

import Campaigns from "./pages/Campaigns"
import CampaignDetail from "./pages/CampaignDetail"

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Campaigns />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}