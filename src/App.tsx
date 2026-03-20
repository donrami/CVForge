import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { NewApplication } from './pages/NewApplication';
import { ApplicationDetail } from './pages/ApplicationDetail';
import { Settings } from './pages/Settings';
import { DialogProvider } from './context/DialogContext';
import { ThemeProvider } from './context/ThemeContext';
import { BackgroundTexture } from './components/BackgroundTexture';

export default function App() {
  return (
    <ThemeProvider>
      <BackgroundTexture />
      <DialogProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="new" element={<NewApplication />} />
            <Route path="applications/:id" element={<ApplicationDetail />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </DialogProvider>
    </ThemeProvider>
  );
}
