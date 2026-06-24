import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import TaskManager from './pages/TaskManager';
import Stats from './pages/Stats';

const App = () => {
  const page =
    localStorage.getItem('page') ||
    (localStorage.getItem('user_id') ? 'dashboard' : 'onboarding');

  if (page === 'onboarding') return <Onboarding />;
  if (page === 'dashboard') return <Dashboard />;
  if (page === 'tasks') return <TaskManager />;
  if (page === 'stats') return <Stats />;
  return <Onboarding />;
};

export default App;

