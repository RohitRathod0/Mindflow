import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import TaskManager from './pages/TaskManager';
import Stats from './pages/Stats';
import VoiceAgent from './pages/VoiceAgent';
import FastHelp from './pages/FastHelp';
import Debrief from './pages/Debrief';

const App = () => {
  const page =
    localStorage.getItem('page') ||
    (localStorage.getItem('user_id') ? 'dashboard' : 'onboarding');

  if (page === 'onboarding') return <Onboarding />;
  if (page === 'dashboard') return <Dashboard />;
  if (page === 'tasks') return <TaskManager />;
  if (page === 'stats') return <Stats />;
  if (page === 'voice') return <VoiceAgent />;
  if (page === 'fast-help') return <FastHelp />;
  if (page === 'debrief') return <Debrief />;
  return <Onboarding />;
};

export default App;

