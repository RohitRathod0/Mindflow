import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import TaskManager from './pages/TaskManager';

const App = () => {
  const page =
    localStorage.getItem('page') ||
    (localStorage.getItem('user_id') ? 'dashboard' : 'onboarding');

  if (page === 'onboarding') return <Onboarding />;
  if (page === 'dashboard') return <Dashboard />;
  if (page === 'tasks') return <TaskManager />;
  return <Onboarding />;
};

export default App;
