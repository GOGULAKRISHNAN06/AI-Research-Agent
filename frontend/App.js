import html from './utils/html.js';
import Sidebar from './components/Sidebar.js';
import SummaryView from './components/SummaryView.js';
import ChatView from './components/ChatView.js';
import QuizView from './components/QuizView.js';
import FlashcardsView from './components/FlashcardsView.js';
import ComparisonView from './components/ComparisonView.js';
import SettingsView from './components/SettingsView.js';

const { useState, useEffect } = window.React;

export default function App() {
  const [activeTab, setActiveTab] = useState('settings');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [modelName, setModelName] = useState(localStorage.getItem('gemini_model_name') || 'gemini-1.5-flash');
  const [embeddingType, setEmbeddingType] = useState('local');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark'); // Default to dark premium theme
  
  // Cache summaries, metadata, quizzes, and chat history in the React app scope
  const [analysisData, setAnalysisData] = useState({});
  const [chatHistory, setChatHistory] = useState({});

  useEffect(() => {
    // Synchronize HTML dark mode styling
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get('/history');
      const history = res.data || [];
      setHistoryList(history);
      
      // Auto-select latest uploaded document if none is selected
      if (history.length > 0 && !selectedDoc) {
        setSelectedDoc(history[history.length - 1]);
        setActiveTab('summary');
      }
    } catch (err) {
      console.error("Failed to load upload history list", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'summary':
        return selectedDoc 
          ? html`<${SummaryView} selectedDoc=${selectedDoc} apiKey=${apiKey} modelName=${modelName} analysisData=${analysisData} setAnalysisData=${setAnalysisData} />` 
          : null;
      case 'chat':
        return selectedDoc 
          ? html`<${ChatView} selectedDoc=${selectedDoc} apiKey=${apiKey} modelName=${modelName} chatHistory=${chatHistory} setChatHistory=${setChatHistory} />` 
          : null;
      case 'quiz':
        return selectedDoc 
          ? html`<${QuizView} selectedDoc=${selectedDoc} apiKey=${apiKey} modelName=${modelName} analysisData=${analysisData} setAnalysisData=${setAnalysisData} />` 
          : null;
      case 'flashcards':
        return selectedDoc 
          ? html`<${FlashcardsView} selectedDoc=${selectedDoc} apiKey=${apiKey} modelName=${modelName} analysisData=${analysisData} setAnalysisData=${setAnalysisData} />` 
          : null;
      case 'compare':
        return html`<${ComparisonView} apiKey=${apiKey} modelName=${modelName} />`;
      case 'settings':
      default:
        return html`<${SettingsView} 
          apiKey=${apiKey} 
          setApiKey=${setApiKey} 
          modelName=${modelName}
          setModelName=${setModelName}
          embeddingType=${embeddingType} 
          setEmbeddingType=${setEmbeddingType} 
          theme=${theme} 
          toggleTheme=${toggleTheme} 
        />`;
    }
  };

  return html`
    <div class="h-full flex overflow-hidden">
      <!-- Left Dashboard Sidebar -->
      <${Sidebar} 
        activeTab=${activeTab} 
        setActiveTab=${setActiveTab}
        selectedDoc=${selectedDoc}
        setSelectedDoc=${setSelectedDoc}
        historyList=${historyList}
        setHistoryList=${setHistoryList}
        fetchHistory=${fetchHistory}
        apiKey=${apiKey}
        embeddingType=${embeddingType}
      />

      <!-- Main Dashboard Work Area -->
      <main class="flex-1 h-full overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative">
        ${renderActiveView()}
      </main>
    </div>
  `;
}

// Mount and start the React application
const container = document.getElementById('root');
const root = window.ReactDOM.createRoot(container);
root.render(window.React.createElement(App));
