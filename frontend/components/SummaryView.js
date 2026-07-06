import { html } from '../utils/html.js';

const { useState, useEffect } = window.React;

export default function SummaryView({ selectedDoc, apiKey, modelName, analysisData, setAnalysisData }) {
  const [activeSubTab, setActiveSubTab] = useState('detailed');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (selectedDoc && !analysisData[selectedDoc.doc_id]?.summary) {
      fetchSummariesAndMetadata();
    }
  }, [selectedDoc]);

  const fetchSummariesAndMetadata = async () => {
    setLoading(true);
    setError('');
    const docId = selectedDoc.doc_id;

    try {
      // 1. Fetch Summaries
      const sumRes = await axios.post('/summary', { doc_id: docId, api_key: apiKey }, {
        headers: { 'X-Gemini-API-Key': apiKey, 'X-Gemini-Model': modelName }
      });
      
      // 2. Fetch Metadata, References, and Keywords
      const metaRes = await axios.post('/metadata', { doc_id: docId, api_key: apiKey }, {
        headers: { 'X-Gemini-API-Key': apiKey, 'X-Gemini-Model': modelName }
      });

      // 3. Fetch Flashcards (cache it immediately too)
      const flashRes = await axios.post('/flashcards', { doc_id: docId, api_key: apiKey }, {
        headers: { 'X-Gemini-API-Key': apiKey, 'X-Gemini-Model': modelName }
      });

      setAnalysisData(prev => ({
        ...prev,
        [docId]: {
          ...prev[docId],
          summary: sumRes.data,
          metadata: metaRes.data.metadata,
          keywords: metaRes.data.keywords,
          references: metaRes.data.references,
          flashcards: flashRes.data.flashcards
        }
      }));
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to analyze document. Ensure your Gemini API Key is set in Settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    const docId = selectedDoc.doc_id;
    const docAnalysis = analysisData[docId] || {};
    
    // Extract key points from detailed summary as dummy if not exists
    const keyPoints = docAnalysis.summary?.medium 
      ? docAnalysis.summary.medium.split('. ').slice(0, 5).map(s => s.trim() + '.')
      : ["Core objectives and methodologies discussed in report."];

    try {
      const response = await axios.post('/export', {
        doc_id: docId,
        format: format,
        title: docAnalysis.metadata?.title || selectedDoc.filename,
        summary: docAnalysis.summary,
        quiz: docAnalysis.quiz || [],
        flashcards: docAnalysis.flashcards || [],
        key_points: keyPoints
      }, { responseType: 'blob' });

      // Create download link
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `research_report_${docId}.${format}`;
      link.click();
    } catch (err) {
      alert('Failed to export document results: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const docId = selectedDoc?.doc_id;
  const docAnalysis = analysisData[docId] || {};
  const metadata = docAnalysis.metadata;
  const summary = docAnalysis.summary;
  const keywords = docAnalysis.keywords;

  if (loading) {
    return html`
      <div class="h-full flex flex-col items-center justify-center p-6 space-y-4">
        <div class="relative w-20 h-20">
          <div class="absolute inset-0 rounded-full border-4 border-indigo-200 dark:border-indigo-950"></div>
          <div class="absolute inset-0 rounded-full border-4 border-t-brand-600 animate-spin"></div>
        </div>
        <div class="text-center">
          <h3 class="font-semibold text-lg text-slate-800 dark:text-white">Synthesizing Document...</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Generating summaries, extracting keywords, and loading reference lists using Gemini.</p>
        </div>
      </div>
    `;
  }

  if (error) {
    return html`
      <div class="h-full flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-4">
        <div class="p-3 bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <div>
          <h3 class="font-semibold text-slate-800 dark:text-white">Analysis Failed</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-2">${error}</p>
        </div>
        <button 
          onClick=${fetchSummariesAndMetadata}
          class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
        >
          Try Again
        </button>
      </div>
    `;
  }

  if (!summary) {
    return html`
      <div class="h-full flex items-center justify-center text-slate-400 dark:text-slate-600 text-sm">
        Select a document from the sidebar to view its summary.
      </div>
    `;
  }

  // Generate markdown output
  const renderMarkdown = (text) => {
    if (!text) return '';
    return html`<div class="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed" dangerouslySetInnerHTML=${{ __html: marked.parse(text) }} />`;
  };

  return html`
    <div class="h-full flex flex-col p-6 overflow-y-auto w-full max-w-5xl mx-auto space-y-6">
      
      <!-- Top Action Bar -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h1 class="text-2xl font-bold font-display text-slate-900 dark:text-white truncate max-w-lg">
            ${metadata?.title || selectedDoc.filename}
          </h1>
          <p class="text-xs text-slate-500 mt-1">${selectedDoc.page_count} pages • ${selectedDoc.word_count.toLocaleString()} words • Difficulty: <span class="font-semibold text-brand-600 dark:text-brand-400">${selectedDoc.difficulty}</span></p>
        </div>
        
        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-400 font-medium">Export:</span>
          <button 
            disabled=${exporting}
            onClick=${() => handleExport('pdf')}
            class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-medium transition-all"
          >
            PDF
          </button>
          <button 
            disabled=${exporting}
            onClick=${() => handleExport('docx')}
            class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-medium transition-all"
          >
            DOCX
          </button>
          <button 
            disabled=${exporting}
            onClick=${() => handleExport('txt')}
            class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-medium transition-all"
          >
            TXT
          </button>
        </div>
      </div>

      <!-- Metadata Card -->
      <div class="glass-panel rounded-2xl p-6 shadow-sm space-y-4">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Research Metadata</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <span class="font-semibold text-slate-500">Authors:</span>
            <p class="text-slate-800 dark:text-slate-200 mt-0.5">${metadata?.authors || 'Not specified'}</p>
          </div>
          <div>
            <span class="font-semibold text-slate-500">Publication Year / Venue:</span>
            <p class="text-slate-800 dark:text-slate-200 mt-0.5">
              ${metadata?.year || 'N/A'} ${metadata?.journal ? `• ${metadata.journal}` : ''} ${metadata?.conference ? `• ${metadata.conference}` : ''}
            </p>
          </div>
          <div class="md:col-span-2">
            <span class="font-semibold text-slate-500">DOI / Document Link:</span>
            <p class="text-brand-600 dark:text-brand-400 mt-0.5 select-all">${metadata?.doi || 'None'}</p>
          </div>
        </div>
        
        ${metadata?.abstract && html`
          <div class="pt-4 border-t border-slate-100 dark:border-slate-800">
            <span class="font-semibold text-xs text-slate-500">Abstract:</span>
            <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed text-justify">${metadata.abstract}</p>
          </div>
        `}
      </div>

      <!-- Keywords Tags -->
      ${keywords && keywords.length > 0 && html`
        <div class="space-y-2">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Document Keywords</h2>
          <div class="flex flex-wrap gap-1.5">
            ${keywords.slice(0, 30).map(tag => html`
              <span key=${tag} class="px-2 py-1 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-900/50 rounded-lg text-xs font-medium">
                #${tag}
              </span>
            `)}
          </div>
        </div>
      `}

      <!-- Tabbed Summary View -->
      <div class="glass-panel rounded-2xl p-6 shadow-sm space-y-4">
        <div class="flex border-b border-slate-200 dark:border-slate-800 pb-px">
          <button 
            onClick=${() => setActiveSubTab('short')}
            class="px-4 py-2 border-b-2 font-medium text-xs transition-colors ${activeSubTab === 'short' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700'}"
          >
            Short Summary (50-100w)
          </button>
          <button 
            onClick=${() => setActiveSubTab('medium')}
            class="px-4 py-2 border-b-2 font-medium text-xs transition-colors ${activeSubTab === 'medium' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700'}"
          >
            Medium Summary (~250w)
          </button>
          <button 
            onClick=${() => setActiveSubTab('detailed')}
            class="px-4 py-2 border-b-2 font-medium text-xs transition-colors ${activeSubTab === 'detailed' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700'}"
          >
            Detailed Breakdown (500w+)
          </button>
        </div>

        <div class="pt-2 min-h-60">
          ${activeSubTab === 'short' && renderMarkdown(summary.short)}
          ${activeSubTab === 'medium' && renderMarkdown(summary.medium)}
          ${activeSubTab === 'detailed' && renderMarkdown(summary.detailed)}
        </div>
      </div>
    </div>
  `;
}
