import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './views/Dashboard';

import Projects from './views/Projects';
import Agents from './views/Agents';
import AgentEditor from './views/AgentEditor';
import Files from './views/Files';

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={null} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/agents/new" element={<AgentEditor />} />
        <Route path="/agents/:id/edit" element={<AgentEditor />} />
        <Route path="/files" element={<Files />} />
      </Route>
    </Routes>
  );
}
