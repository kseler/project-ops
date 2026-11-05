import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { TaskDrawer } from './components/TaskDrawer';
import { Toaster } from './components/Toaster';
import { Dashboard } from './pages/Dashboard';
import { Onboarding } from './pages/Onboarding';
import { ProjectDetail } from './pages/ProjectDetail';
import { Projects } from './pages/Projects';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { OrganizationRoute } from './routes/OrganizationRoute';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { PublicRoute } from './routes/PublicRoute';

export const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster />
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/sign-up" element={<SignUp />} />
          </Route>
          <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<Onboarding />} />

              <Route element={<OrganizationRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/projects/:id" element={<ProjectDetail />}>
                    <Route path="tasks/:taskId" element={<TaskDrawer />} />
                  </Route>
                </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
