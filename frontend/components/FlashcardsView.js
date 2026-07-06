import { html } from '../utils/html.js';

const { useState, useEffect } = window.React;

export default function FlashcardsView({ selectedDoc, apiKey, modelName, analysisData, setAnalysisData }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Game states
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const docId = selectedDoc?.doc_id;

  useEffect(() => {
    if (selectedDoc) {
      const docAnalysis = analysisData[docId] || {};
      if (docAnalysis.flashcards) {
        setCards(docAnalysis.flashcards);
      } else {
        fetchFlashcards();
      }
    }
  }, [selectedDoc]);

  const fetchFlashcards = async () => {
    setLoading(true);
    setError('');
    setIsFlipped(false);
    setCurrentIdx(0);

    try {
      const res = await axios.post('/flashcards', {
        doc_id: docId,
        api_key: apiKey
      }, {
        headers: { 'X-Gemini-API-Key': apiKey, 'X-Gemini-Model': modelName }
      });

      if (!res.data.flashcards || res.data.flashcards.length === 0) {
        throw new Error("No flashcards could be generated from this document.");
      }

      setCards(res.data.flashcards);
      
      // Save cache
      setAnalysisData(prev => ({
        ...prev,
        [docId]: {
          ...prev[docId],
          flashcards: res.data.flashcards
        }
      }));
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to generate flashcards. Ensure your Gemini API Key is set.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIdx + 1 < cards.length) {
        setCurrentIdx(prev => prev + 1);
      } else {
        setCurrentIdx(0); // Loop back
      }
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIdx > 0) {
        setCurrentIdx(prev => prev - 1);
      } else {
        setCurrentIdx(cards.length - 1); // Loop to end
      }
    }, 150);
  };

  if (loading) {
    return html`
      <div class="h-full flex flex-col items-center justify-center p-6 space-y-4">
        <div class="relative w-16 h-16 animate-pulse">
          <div class="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8 text-indigo-600 dark:text-indigo-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="m9 9 6-6m0 0 6 6m-6-6v12m0 0-3-3m3 3 3-3M3 15a6 6 0 0 1 12 0v3" />
            </svg>
          </div>
        </div>
        <div class="text-center">
          <h3 class="font-semibold text-lg text-slate-800 dark:text-white">Curating Study Decks...</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Extracting definitions, formulas, and main methods into flippable cards.</p>
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
          <h3 class="font-semibold text-slate-800 dark:text-white">Flashcard Generation Failed</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-2">${error}</p>
        </div>
        <button 
          onClick=${fetchFlashcards}
          class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
        >
          Try Again
        </button>
      </div>
    `;
  }

  if (cards.length === 0) {
    return html`
      <div class="h-full flex items-center justify-center text-slate-400 dark:text-slate-600 text-sm">
        Select a document in the sidebar to generate flashcards.
      </div>
    `;
  }

  const cardObj = cards[currentIdx];

  return html`
    <div class="h-full flex flex-col p-6 items-center justify-center max-w-2xl mx-auto w-full space-y-8">
      <div class="text-center space-y-1">
        <h2 class="text-xl font-bold font-display text-slate-900 dark:text-white">Active Recall Flashcards</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400">Click the card to flip and verify your understanding.</p>
      </div>

      <!-- 3D Flippable Card -->
      <div 
        onClick=${() => setIsFlipped(!isFlipped)}
        class="w-full max-w-md h-72 cursor-pointer group ${isFlipped ? 'flashcard-flipped' : ''}"
        style="perspective: 1000px;"
      >
        <div class="flashcard-inner relative w-full h-full duration-500 transform preserve-3d shadow-md hover:shadow-xl rounded-2xl">
          
          <!-- Card Front -->
          <div class="flashcard-front absolute inset-0 w-full h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl flex flex-col justify-between p-8 text-center backface-hidden">
            <span class="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest">Question / Concept</span>
            <div class="my-auto">
              <h3 class="text-base md:text-lg font-bold text-slate-900 dark:text-white leading-relaxed select-none">
                ${cardObj.front}
              </h3>
            </div>
            <div class="flex justify-center items-center gap-1.5 text-slate-400 text-[10px] font-semibold uppercase">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Click to Reveal Answer
            </div>
          </div>

          <!-- Card Back -->
          <div class="flashcard-back absolute inset-0 w-full h-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col justify-between p-8 text-center backface-hidden">
            <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Answer / Explainer</span>
            <div class="my-auto overflow-y-auto max-h-36 pr-1">
              <p class="text-xs md:text-sm text-slate-700 dark:text-slate-200 leading-relaxed text-justify md:text-center select-none font-medium">
                ${cardObj.back}
              </p>
            </div>
            <div class="flex justify-center items-center gap-1.5 text-slate-400 text-[10px] font-semibold uppercase">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Click to Return to Question
            </div>
          </div>

        </div>
      </div>

      <!-- Navigation & Count -->
      <div class="flex items-center gap-6 text-sm font-semibold">
        <button 
          onClick=${handlePrev}
          class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all text-slate-600 dark:text-slate-400"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        
        <span class="text-slate-500 text-xs">${currentIdx + 1} of ${cards.length} cards</span>
        
        <button 
          onClick=${handleNext}
          class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all text-slate-600 dark:text-slate-400"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  `;
}
