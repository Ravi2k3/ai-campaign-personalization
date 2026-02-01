import { BrowserRouter, Routes, Route } from "react-router-dom"
import Campaigns from "./pages/Campaigns"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Campaigns />} />
      </Routes>
    </BrowserRouter>
  )
}