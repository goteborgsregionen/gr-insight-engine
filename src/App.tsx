import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import DocumentUpload from "./pages/DocumentUpload";
import Reports from "./pages/Reports";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";
import Analysis from "./pages/Analysis";
import AnalysisWorkspace from "./pages/AnalysisWorkspace";
import Presentation from "./pages/Presentation";
import DocumentEvidence from "./pages/DocumentEvidence";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={session ? <Navigate to="/dashboard" /> : <Auth />}
            />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/dashboard"
              element={session ? <Dashboard /> : <Navigate to="/" />}
            />
            <Route
              path="/documents"
              element={session ? <Documents /> : <Navigate to="/" />}
            />
            <Route
              path="/documents/upload"
              element={session ? <DocumentUpload /> : <Navigate to="/" />}
            />
            <Route
              path="/reports"
              element={session ? <Reports /> : <Navigate to="/" />}
            />
            <Route
              path="/analysis"
              element={session ? <Analysis /> : <Navigate to="/" />}
            />
            <Route
              path="/analysis/:sessionId"
              element={session ? <AnalysisWorkspace /> : <Navigate to="/" />}
            />
            <Route
              path="/chat"
              element={session ? <Chat /> : <Navigate to="/" />}
            />
            <Route
              path="/presentation"
              element={session ? <Presentation /> : <Navigate to="/" />}
            />
            <Route
              path="/documents/:documentId/evidence"
              element={session ? <DocumentEvidence /> : <Navigate to="/" />}
            />
            <Route
              path="/settings"
              element={session ? <Settings /> : <Navigate to="/" />}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
