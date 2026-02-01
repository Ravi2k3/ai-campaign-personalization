import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "@/components/theme-provider"

import Campaigns from "./pages/Campaigns"

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Campaigns />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}