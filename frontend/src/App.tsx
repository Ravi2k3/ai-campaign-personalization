import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/AuthContext"
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import ProtectedRoute from "@/components/ProtectedRoute"
import AppLayout from "@/components/AppLayout"

import Login from "./pages/Login"
import AuthCallback from "./pages/AuthCallback"
import Campaigns from "./pages/Campaigns"
import CampaignDetail from "./pages/CampaignDetail"
import LeadDetail from "./pages/LeadDetail"
import NotFound from "./pages/NotFound"

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <AuthProvider>
        <BreadcrumbProvider>
          <TooltipProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Protected routes with persistent layout */}
              <Route path="/" element={<ProtectedLayout><Campaigns /></ProtectedLayout>} />
              <Route path="/campaigns/:id" element={<ProtectedLayout><CampaignDetail /></ProtectedLayout>} />
              <Route path="/campaigns/:campaignId/leads/:leadId" element={<ProtectedLayout><LeadDetail /></ProtectedLayout>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <Toaster />
          </TooltipProvider>
        </BreadcrumbProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
