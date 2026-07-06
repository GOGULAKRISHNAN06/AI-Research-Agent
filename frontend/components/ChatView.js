import { html } from '../utils/html.js';

const { useState, useEffect, useRef } = window.React;

export default function ChatView({ selectedDoc, apiKey, modelName, chatHistory, setChatHistory }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [beginnerMode, setBeginnerMode] = useState(false);
  
  // Search Inside PDF state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [docPages, setDocPages] = useState([]);
  const [searching, setSearching] = useState(false);

  const messagesEndRef = useRef(null);

  // Sync with global chat history
  useEffect(() => {
    if (selectedDoc) {
      setMessages(chatHistory[selectedDoc.doc_id] || [
        { 
          role: 'assistant', 
          text: `Hi! I am your research assistant for **${selectedDoc.filename}**. Ask me anything about the document, or use the **Search Inside PDF** tab to find specific keywords.` 
        }
      ]);
      fetchDocumentPages(); // load full pages for local searching
    }
  }, [selectedDoc]);

  // Save to global chat history on changes
  useEffect(() => {
    if (selectedDoc && messages.length > 0) {
      setChatHistory(prev => ({
        ...prev,
        [selectedDoc.doc_id]: messages
      }));
    }
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchDocumentPages = async () => {
    try {
      const res = await axios.get(`/document/${selectedDoc.doc_id}`);
      setDocPages(res.data.pages || []);
    } catch (err) {
      console.error("Failed to load document text for search", err);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post('/chat', {
        doc_id: selectedDoc.doc_id,
        question: input,
        beginner_mode: beginnerMode,
        api_key: apiKey
      }, {
        headers: { 'X-Gemini-API-Key': apiKey, 'X-Gemini-Model': modelName }
      });

      const assistantMessage = {
        role: 'assistant',
        text: res.data.answer,
        citations: res.data.citations || [],
        confidence: res.data.confidence_score
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Error: ${err.response?.data?.detail || 'Could not communicate with the backend. Check your API key in Settings.'}`,
        error: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Local Keyword Search inside document pages
  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    const results = [];

    docPages.forEach(p => {
      p.paragraphs.forEach((para, idx) => {
        if (para.toLowerCase().includes(query.toLowerCase())) {
          // Highlight match in snippet
          const snippet = para.replace(regex, '<mark class="bg-yellow-300 dark:bg-yellow-800/80 px-1 rounded">$1</mark>');
          results.append({
            page: p.page,
            paraIndex: idx,
            htmlSnippet: snippet
          });
        }
      });
    });

    setSearchResults(results.slice(0, 30)); // Cap at 30 search matches
    setSearching(false);
  };

  // Helper to color confidence score badge
  const getConfidenceBadge = (score) => {
    if (score >= 0.8) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50';
    if (score >= 0.5) return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-900/50';
    return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-900/50';
  };

  return html`
    <div class="h-full flex w-full overflow-hidden">
      <!-- Main Chat Area -->
      <div class="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/20 border-r border-slate-100 dark:border-slate-800/50">
        
        <!-- Chat Header -->
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 class="font-semibold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">${selectedDoc.filename}</h2>
            <p class="text-xs text-slate-500">Ask any question below. The agent answers ONLY using document contents.</p>
          </div>
          
          <!-- Beginner Mode Toggle -->
          <div class="flex items-center space-x-2">
            <span class="text-xs font-semibold text-slate-500">Beginner Mode</span>
            <button 
              onClick=${() => setBeginnerMode(!beginnerMode)} 
              class="w-10 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${beginnerMode ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-800'} flex items-center"
            >
              <div class="w-4 h-4 rounded-full bg-white transition-transform transform ${beginnerMode ? 'translate-x-5' : 'translate-x-0'} shadow-sm"></div>
            </button>
          </div>
        </div>

        <!-- Chat History -->
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          ${messages.map((msg, idx) => html`
            <div key=${idx} class="flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}">
              <div class="max-w-[85%] rounded-2xl p-4 shadow-sm text-sm border 
                ${msg.role === 'user' 
                  ? 'bg-brand-600 text-white border-brand-500 rounded-tr-none' 
                  : msg.error 
                    ? 'bg-red-50 text-red-800 border-red-200 rounded-tl-none dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/35'
                    : 'glass-panel text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 rounded-tl-none'
                }"
              >
                <!-- Message content -->
                <div class="prose prose-sm dark:prose-invert" dangerouslySetInnerHTML=${{ __html: marked.parse(msg.text) }} />
                
                <!-- Assistant Metadata: Citations and Confidence -->
                ${msg.role === 'assistant' && !msg.error && (msg.citations?.length > 0 || msg.confidence !== undefined) && html`
                  <div class="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-wrap gap-2 items-center text-xs">
                    
                    <!-- Confidence Score -->
                    ${msg.confidence !== undefined && html`
                      <span class="px-2 py-0.5 rounded-full border text-[10px] font-semibold ${getConfidenceBadge(msg.confidence)}">
                        Confidence: ${(msg.confidence * 100).toFixed(0)}%
                      </span>
                    `}
                    
                    <!-- Page Citations -->
                    ${msg.citations?.length > 0 && html`
                      <div class="flex items-center gap-1">
                        <span class="text-slate-400">Sources:</span>
                        <div class="flex flex-wrap gap-1">
                          ${msg.citations.map((cite, cIdx) => html`
                            <div key=${cIdx} class="group relative inline-block">
                              <span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500 rounded text-brand-600 dark:text-brand-400 font-semibold cursor-pointer text-[10px]">
                                Page ${cite.page}
                              </span>
                              <!-- Citation Tooltip Hover -->
                              <div class="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-slate-900 dark:bg-slate-900 text-white rounded-lg p-3 shadow-xl text-xs z-30 border border-slate-800 leading-relaxed">
                                <p class="font-bold text-[10px] text-brand-400 border-b border-slate-800 pb-1 mb-1">Page ${cite.page} Excerpt:</p>
                                "${cite.snippet}"
                                <div class="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-900 border-r border-b border-slate-800 rotate-45"></div>
                              </div>
                            </div>
                          `)}
                        </div>
                      </div>
                    `}
                  </div>
                `}
              </div>
            </div>
          `)}

          <!-- Loading Spinner -->
          ${loading && html`
            <div class="flex justify-start">
              <div class="glass-panel border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none p-4 flex items-center space-x-2">
                <span class="flex h-2 w-2 relative">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                </span>
                <span class="text-xs text-slate-500 dark:text-slate-400 typing-cursor">AI Assistant is thinking</span>
              </div>
            </div>
          `}
          <div ref=${messagesEndRef} />
        </div>

        <!-- Chat Input Form -->
        <form onSubmit=${handleSend} class="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-white/50 dark:bg-slate-950/20 backdrop-blur-lg flex gap-2">
          <input 
            type="text"
            value=${input}
            onChange=${(e) => setInput(e.target.value)}
            placeholder=${beginnerMode ? "Ask me anything in simple terms..." : "Ask questions (e.g. limitations, methods, datasets...)"}
            disabled=${loading}
            class="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm shadow-inner"
          />
          <button 
            type="submit"
            disabled=${loading || !input.trim()}
            class="px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-semibold transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500 flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
            Send
          </button>
        </form>
      </div>

      <!-- Keyword Search Inside PDF Sidebar -->
      <div class="w-80 h-full hidden lg:flex flex-col bg-white/40 dark:bg-slate-950/10 p-4 overflow-y-auto">
        <h3 class="font-semibold text-slate-800 dark:text-white text-sm mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-brand-600">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
          </svg>
          Search Inside PDF
        </h3>
        
        <input 
          type="text" 
          value=${searchQuery}
          onChange=${handleSearch}
          placeholder="Type keyword to highlight..."
          class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 mb-4"
        />

        <div class="flex-1 space-y-3">
          ${searchResults.length === 0 ? html`
            <div class="text-center text-slate-400 dark:text-slate-600 text-xs mt-10">
              ${searchQuery.trim() ? 'No matching paragraphs found.' : 'Enter a keyword above to scan document text instantly.'}
            </div>
          ` : html`
            <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Matches found (${searchResults.length})</div>
            ${searchResults.map((res, sIdx) => html`
              <div key=${sIdx} class="p-3 bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-xl text-xs space-y-1.5 hover:shadow-sm transition-all">
                <div class="flex justify-between items-center text-[10px] text-brand-600 dark:text-brand-400 font-bold">
                  <span>Page ${res.page}</span>
                  <span class="text-slate-400">Paragraph #${res.paraIndex + 1}</span>
                </div>
                <p class="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]" dangerouslySetInnerHTML=${{ __html: res.htmlSnippet }}></p>
              </div>
            `)}
          `}
        </div>
      </div>
    </div>
  `;
}
