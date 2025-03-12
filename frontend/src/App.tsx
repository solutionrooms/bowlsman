import { usePageViewLogger } from './hooks/usePageViewLogger';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

// Separate component for content to use router hooks
function AppContent() {
  // Initialize page view logging
  usePageViewLogger();

  return (
    <Routes>
      {/* Your routes go here */}
      <Route path="/" element={<div>Home Page</div>} />
      {/* Add more routes as needed */}
    </Routes>
  );
}

export default App; 