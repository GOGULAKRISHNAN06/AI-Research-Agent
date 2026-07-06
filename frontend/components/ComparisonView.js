import { html } from '../utils/html.js';

const { useState } = window.React;

export default function ComparisonView({ apiKey, modelName }) {
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e, fileNum) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      if (fileNum === 1) setFile1(file);
      else setFile2(file);
    } else {
      alert("Only PDF files are supported.");
    }
  };

  const handleCompare = async () => {
    if (!file1 || !file2) return;
    setLoading(true);
    setError('');
    setComparison(null);

    const formData = new FormData();
    formData.append('file1', file1);
    formData.append('file2', file2);

    try {
      const res = await axios.post('/compare', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Gemini-API-Key': apiKey,
          'X-Gemini-Model': modelName
        }
      });
      setComparison(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to compare documents. Make sure Gemini API Key is entered in Settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile1(null);
    setFile2(null);
    setComparison(null);
    setError('');
  };

  if (loading) {
    return html`
      <div class="h-full flex flex-col items-center justify-center p-6 space-y-4">
        <div class="flex items-center space-x-2">
          <div class="w-4 h-4 bg-brand-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
          <div class="w-4 h-4 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
          <div class="w-4 h-4 bg-fuchsia-500 rounded-full animate-bounce" style="animation-delay: 0.3s"></div>
        </div>
        <div class="text-center">
          <h3 class="font-semibold text-lg text-slate-800 dark:text-white">Analyzing & Comparing Documents...</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Parsing both papers and synthesizing side-by-side summaries using Gemini.</p>
        </div>
      </div>
    `;
  }

  if (error) {
    return html`
      <div class="h-full flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-4">
        <div class="p-3 bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <div>
          <h3 class="font-semibold text-slate-800 dark:text-white">Comparison Failed</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-2">${error}</p>
        </div>
        <button 
          onClick=${handleReset}
          class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
        >
          Reset and Try Again
        </button>
      </div>
    `;
  }

  // Render Comparison Screen
  if (comparison) {
    const doc1 = comparison.doc1 || {};
    const doc2 = comparison.doc2 || {};
    const diff = comparison.comparison || {};

    const matrixRow = (label, val1, val2, diffText) => html`
      <div class="border-b border-slate-100 dark:border-slate-800 pb-6 pt-4 space-y-4">
        <h4 class="text-sm font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">${label}</h4>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Doc 1 Info -->
          <div class="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs leading-relaxed space-y-1">
            <span class="font-semibold text-slate-400">Document 1 Details:</span>
            <p class="text-slate-700 dark:text-slate-300 font-medium">${val1}</p>
          </div>
          
          <!-- Doc 2 Info -->
          <div class="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs leading-relaxed space-y-1">
            <span class="font-semibold text-slate-400">Document 2 Details:</span>
            <p class="text-slate-700 dark:text-slate-300 font-medium">${val2}</p>
          </div>
        </div>

        <!-- Synthesized comparison notes -->
        <div class="p-4 bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl text-xs leading-relaxed">
          <span class="font-bold text-indigo-700 dark:text-indigo-400 block mb-1">Comparative Synthesis:</span>
          <p class="text-slate-600 dark:text-slate-400">${diffText}</p>
        </div>
      </div>
    `;

    return html`
      <div class="h-full flex flex-col p-6 overflow-y-auto max-w-5xl mx-auto w-full space-y-6">
        
        <!-- Header -->
        <div class="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h1 class="text-2xl font-bold font-display text-slate-900 dark:text-white">Comparative Matrix</h1>
            <p class="text-xs text-slate-500">Comparing: <span class="font-semibold text-slate-800 dark:text-slate-200">${doc1.title}</span> vs <span class="font-semibold text-slate-800 dark:text-slate-200">${doc2.title}</span></p>
          </div>
          <button 
            onClick=${handleReset}
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold transition-all"
          >
            Compare Others
          </button>
        </div>

        <!-- Matrix Sections -->
        <div class="space-y-2">
          ${matrixRow('Research Objectives', doc1.objectives, doc2.objectives, diff.objectives_diff)}
          ${matrixRow('Methodology / Approach', doc1.methods, doc2.methods, diff.methods_diff)}
          ${matrixRow('Key Findings & Results', doc1.results, doc2.results, diff.results_diff)}
          ${matrixRow('Conclusions & Future Outlook', doc1.conclusions, doc2.conclusions, diff.conclusions_diff)}
        </div>
      </div>
    `;
  }

  // Setup / Select Files Screen
  return html`
    <div class="h-full flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full space-y-8">
      <div class="text-center space-y-2">
        <h2 class="text-2xl font-bold font-display text-slate-900 dark:text-white">Document Comparison Matrix</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          Upload two PDF research papers or reports side-by-side. 
          The agent will compare their objectives, methods, and results to help you analyze similarities and differences.
        </p>
      </div>

      <!-- File Select Panel -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        
        <!-- Document 1 box -->
        <div class="glass-panel border-2 border-dashed ${file1 ? 'border-brand-500' : 'border-slate-200 dark:border-slate-800'} rounded-3xl p-6 flex flex-col items-center justify-center text-center relative hover:shadow-md transition-all h-60">
          <input 
            type="file" 
            accept="application/pdf"
            onChange=${(e) => handleFileChange(e, 1)}
            class="absolute inset-0 opacity-0 cursor-pointer"
          />
          <div class="p-3 bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 rounded-2xl mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          ${file1 ? html`
            <h4 class="font-bold text-sm text-slate-800 dark:text-white truncate max-w-[200px]">${file1.name}</h4>
            <p class="text-[10px] text-slate-400 mt-1">${(file1.size / (1024 * 1024)).toFixed(2)} MB</p>
          ` : html`
            <h4 class="font-bold text-sm text-slate-800 dark:text-white">Upload Document 1</h4>
            <p class="text-[10px] text-slate-400 mt-1">Drag & drop PDF here</p>
          `}
        </div>

        <!-- Document 2 box -->
        <div class="glass-panel border-2 border-dashed ${file2 ? 'border-brand-500' : 'border-slate-200 dark:border-slate-800'} rounded-3xl p-6 flex flex-col items-center justify-center text-center relative hover:shadow-md transition-all h-60">
          <input 
            type="file" 
            accept="application/pdf"
            onChange=${(e) => handleFileChange(e, 2)}
            class="absolute inset-0 opacity-0 cursor-pointer"
          />
          <div class="p-3 bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 rounded-2xl mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          ${file2 ? html`
            <h4 class="font-bold text-sm text-slate-800 dark:text-white truncate max-w-[200px]">${file2.name}</h4>
            <p class="text-[10px] text-slate-400 mt-1">${(file2.size / (1024 * 1024)).toFixed(2)} MB</p>
          ` : html`
            <h4 class="font-bold text-sm text-slate-800 dark:text-white">Upload Document 2</h4>
            <p class="text-[10px] text-slate-400 mt-1">Drag & drop PDF here</p>
          `}
        </div>

      </div>

      <!-- Action Button -->
      <button 
        disabled=${!file1 || !file2}
        onClick=${handleCompare}
        class="px-8 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500 w-full max-w-xs"
      >
        Compare Documents
      </button>
    </div>
  `;
}
