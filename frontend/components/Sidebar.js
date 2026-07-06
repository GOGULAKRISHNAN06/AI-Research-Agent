import { html } from '../utils/html.js';

const { useState } = window.React;

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  selectedDoc, 
  setSelectedDoc, 
  historyList, 
  setHistoryList,
  fetchHistory,
  apiKey,
  embeddingType
}) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      alert("Only PDF documents are supported.");
      return;
    }
    
    // Size check: 50MB
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("File size exceeds 50MB maximum limit.");
      return;
    }

    setUploading(true);
    setUploadProgress(15); // initial progress indicator
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const headers = { 'Content-Type': 'multipart/form-data' };
      if (apiKey) headers['X-Gemini-API-Key'] = apiKey;
      if (embeddingType) headers['X-Embedding-Type'] = embeddingType;

      const res = await axios.post('/upload', formData, {
        headers: headers,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          // scale progress between 15% and 90% until backend completes parsing
          setUploadProgress(15 + Math.round(percentCompleted * 0.75));
        }
      });
      
      setUploadProgress(100);
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        // Add to history and select it
        setSelectedDoc(res.data);
        setActiveTab('summary');
        fetchHistory(); // refresh history list
      }, 500);

    } catch (err) {
      console.error(err);
      alert("Upload failed: " + (err.response?.data?.detail || err.message));
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  };

  const handleDeleteDoc = async (e, docId) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this document and its vector database?")) return;
    
    try {
      await axios.delete(`/history/${docId}`);
      if (selectedDoc?.doc_id === docId) {
        setSelectedDoc(null);
        setActiveTab('settings');
      }
      fetchHistory();
    } catch (err) {
      alert("Failed to delete document: " + err.message);
    }
  };

  // Nav Item layout
  const navItem = (tabId, label, svgPath) => {
    const isSelected = activeTab === tabId;
    const isDisabled = !selectedDoc && tabId !== 'settings' && tabId !== 'compare';
    
    let baseStyle = "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all w-full text-left ";
    if (isDisabled) {
      baseStyle += "text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50";
    } else if (isSelected) {
      baseStyle += "bg-brand-600 text-white shadow-sm";
    } else {
      baseStyle += "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/60";
    }

    return html`
      <button 
        disabled=${isDisabled}
        onClick=${() => setActiveTab(tabId)}
        class=${baseStyle}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-4 h-4 shrink-0">
          ${svgPath}
        </svg>
        <span>${label}</span>
      </button>
    `;
  };

  return html`
    <aside class="w-72 h-full glass-panel border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
      <!-- Title Logo -->
      <div class="p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center space-x-2 shrink-0">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md font-bold text-sm">
          R
        </div>
        <div>
          <h1 class="font-bold text-sm font-display text-slate-900 dark:text-white leading-none">Research Agent</h1>
          <span class="text-[9px] font-bold text-brand-600 uppercase tracking-widest">RAG Assistant</span>
        </div>
      </div>

      <!-- Upload Section -->
      <div class="p-4 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
        ${uploading ? html`
          <!-- Upload Progress -->
          <div class="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
            <div class="flex justify-between items-center text-[10px] font-bold text-slate-500">
              <span class="animate-pulse">Parsing PDF...</span>
              <span>${uploadProgress}%</span>
            </div>
            <div class="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div class="bg-brand-500 h-full transition-all duration-300" style="width: ${uploadProgress}%"></div>
            </div>
          </div>
        ` : html`
          <!-- Drop Area -->
          <div 
            onDragOver=${(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave=${() => setDragOver(false)}
            onDrop=${handleFileDrop}
            class="group border-2 border-dashed ${dragOver ? 'border-brand-500 bg-brand-50/20' : 'border-slate-200 dark:border-slate-800/80'} hover:border-brand-400 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 rounded-2xl p-4 text-center cursor-pointer transition-all relative flex flex-col items-center justify-center"
          >
            <input 
              type="file" 
              accept="application/pdf"
              onChange=${(e) => handleFileUpload(e.target.files[0])}
              class="absolute inset-0 opacity-0 cursor-pointer"
            />
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-slate-400 group-hover:text-brand-500 mb-1.5 transition-colors">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300">Upload PDF Document</span>
            <span class="text-[9px] text-slate-400 mt-0.5">Drag PDF here up to 50MB</span>
          </div>
        `}
      </div>

      <!-- Navigation Tabs -->
      <nav class="p-4 space-y-1 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
        <!-- Summary Tab -->
        ${navItem('summary', 'AI Summary', html`
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
        `)}
        <!-- Chat Tab -->
        ${navItem('chat', 'Ask Anything (RAG)', html`
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-2.833A7.9 7.9 0 0 1 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
        `)}
        <!-- Quiz Tab -->
        ${navItem('quiz', 'Quiz Generator', html`
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.03 0 1.9.732 2.076 1.704m-12.18 1.958 1.547-1.173a.75.75 0 0 1 .917 1.189l-1.875 1.422A.75.75 0 0 1 5 8.25v-.75c0-1.135.845-2.098 1.976-2.192a48.424 48.424 0 0 1 1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 5.625 2.25H7.125c1.03 0 1.9.732 2.076 1.704m-12.18 1.958 1.547-1.173a.75.75 0 0 1 .917 1.189l-1.875 1.422A.75.75 0 0 1 13.5 8.25" />
        `)}
        <!-- Flashcard Tab -->
        ${navItem('flashcards', 'Flashcards Revision', html`
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
        `)}
        <!-- Comparison Tab -->
        ${navItem('compare', 'Compare two PDFs', html`
          <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        `)}
        <!-- Settings Tab -->
        ${navItem('settings', 'Workspace Settings', html`
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827a1.125 1.125 0 0 1 .26 1.43l-1.297 2.247a1.125 1.125 0 0 1-1.37.491l-1.216-.456c-.356-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        `)}
      </nav>

      <!-- History / Files List -->
      <div class="flex-1 overflow-y-auto p-4 flex flex-col min-h-0">
        <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 shrink-0">Upload History</h3>
        
        <div class="space-y-2 flex-1 min-h-0 overflow-y-auto">
          ${historyList.length === 0 ? html`
            <div class="text-center text-slate-400 dark:text-slate-600 text-[10px] mt-10">
              No documents in history. Upload a PDF above to begin.
            </div>
          ` : html`
            ${historyList.map(doc => {
              const isSelected = selectedDoc?.doc_id === doc.doc_id;
              let itemStyle = "p-3 rounded-xl border text-left transition-all w-full relative flex items-start justify-between group ";
              if (isSelected) {
                itemStyle += "border-brand-500 bg-brand-50/30 dark:bg-brand-950/20";
              } else {
                itemStyle += "border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/10 hover:border-slate-200 dark:hover:border-slate-800/80";
              }
              
              return html`
                <div 
                  key=${doc.doc_id} 
                  onClick=${() => { setSelectedDoc(doc); setActiveTab('summary'); }}
                  class=${itemStyle}
                >
                  <div class="min-w-0 pr-6">
                    <h4 class="font-bold text-xs text-slate-800 dark:text-slate-200 truncate select-none">${doc.filename}</h4>
                    <div class="flex items-center gap-1.5 text-[9px] text-slate-400 mt-1 select-none font-medium">
                      <span>${doc.page_count} pgs</span>
                      <span>•</span>
                      <span>${doc.difficulty}</span>
                    </div>
                  </div>
                  
                  <!-- Delete button (visible on hover) -->
                  <button 
                    onClick=${(e) => handleDeleteDoc(e, doc.doc_id)}
                    class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 absolute right-2.5 top-2.5 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-all focus:outline-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              `;
            })}
          `}
        </div>
      </div>
    </aside>
  `;
}
