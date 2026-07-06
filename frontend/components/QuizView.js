import { html } from '../utils/html.js';

const { useState, useEffect } = window.React;

export default function QuizView({ selectedDoc, apiKey, modelName, analysisData, setAnalysisData }) {
  const [numQuestions, setNumQuestions] = useState(5);
  const [quizList, setQuizList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Game states
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [quizHistory, setQuizHistory] = useState([]); // tracks user's choices

  const docId = selectedDoc?.doc_id;

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setShowResults(false);
    setCurrentIdx(0);
    setScore(0);
    setQuizList([]);
    setQuizHistory([]);
    setSubmitted(false);
    setSelectedOpt('');

    try {
      const res = await axios.post('/quiz', {
        doc_id: docId,
        num_questions: numQuestions,
        api_key: apiKey
      }, {
        headers: { 'X-Gemini-API-Key': apiKey, 'X-Gemini-Model': modelName }
      });

      if (!res.data.quizzes || res.data.quizzes.length === 0) {
        throw new Error("No quiz questions were returned. The document might be too short or generic.");
      }

      setQuizList(res.data.quizzes);
      
      // Save to global analysis store
      setAnalysisData(prev => ({
        ...prev,
        [docId]: {
          ...prev[docId],
          quiz: res.data.quizzes
        }
      }));
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to generate quiz. Make sure Gemini API Key is configured.');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (opt) => {
    if (submitted) return;
    setSelectedOpt(opt);
  };

  const handleSubmitAnswer = () => {
    if (!selectedOpt || submitted) return;
    
    const correctAns = quizList[currentIdx].correct_answer;
    
    // Clean string matches just in case LLM added option letters like 'A) '
    const cleanOpt = selectedOpt.replace(/^[A-D]\)\s*/i, '').trim().toLowerCase();
    const cleanCorrect = correctAns.replace(/^[A-D]\)\s*/i, '').trim().toLowerCase();
    
    const isCorrect = cleanOpt === cleanCorrect || correctAns.includes(selectedOpt) || selectedOpt.includes(correctAns);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    setQuizHistory(prev => [...prev, {
      question: quizList[currentIdx].question,
      userAnswer: selectedOpt,
      correctAnswer: correctAns,
      isCorrect: isCorrect,
      explanation: quizList[currentIdx].explanation
    }]);

    setSubmitted(true);
  };

  const handleNext = () => {
    setSubmitted(false);
    setSelectedOpt('');
    if (currentIdx + 1 < quizList.length) {
      setCurrentIdx(prev => prev + 1);
    } else {
      setShowResults(true);
    }
  };

  const handleRestart = () => {
    setQuizList([]);
    setShowResults(false);
    setCurrentIdx(0);
    setScore(0);
    setQuizHistory([]);
  };

  if (loading) {
    return html`
      <div class="h-full flex flex-col items-center justify-center p-6 space-y-4">
        <div class="relative w-16 h-16 animate-bounce">
          <div class="w-16 h-16 rounded-2xl bg-brand-500/20 border border-brand-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8 text-brand-600 dark:text-brand-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
            </svg>
          </div>
        </div>
        <div class="text-center">
          <h3 class="font-semibold text-lg text-slate-800 dark:text-white">Drafting Comprehension Quiz...</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Generating ${numQuestions} custom questions and explanation blocks from the document sections.</p>
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
          <h3 class="font-semibold text-slate-800 dark:text-white">Quiz Generation Failed</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-2">${error}</p>
        </div>
        <button 
          onClick=${handleRestart}
          class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
        >
          Reset Setup
        </button>
      </div>
    `;
  }

  // Final Results Slide
  if (showResults) {
    const scorePct = (score / quizList.length) * 100;
    let message = 'Keep reading! Go back and review the summaries.';
    let iconColor = 'text-amber-500';
    if (scorePct >= 80) {
      message = 'Excellent! You have mastered the contents of this document.';
      iconColor = 'text-emerald-500';
    } else if (scorePct >= 50) {
      message = 'Good job! Review the questions you got wrong to reinforce your memory.';
      iconColor = 'text-brand-500';
    }

    return html`
      <div class="h-full flex flex-col p-6 overflow-y-auto max-w-3xl mx-auto w-full space-y-6">
        <div class="glass-panel rounded-3xl p-8 text-center shadow-lg space-y-6">
          <div class="flex justify-center">
            <div class="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-900 border-4 border-slate-200 dark:border-slate-800 flex items-center justify-center text-3xl font-extrabold ${iconColor}">
              ${score}/${quizList.length}
            </div>
          </div>
          <div>
            <h2 class="text-2xl font-bold font-display text-slate-900 dark:text-white">Quiz Completed!</h2>
            <p class="text-sm font-semibold mt-2 ${iconColor}">${scorePct.toFixed(0)}% Score</p>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed">${message}</p>
          </div>
          <div class="flex justify-center gap-3">
            <button 
              onClick=${handleRestart}
              class="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 font-semibold text-sm transition-all"
            >
              Generate New Quiz
            </button>
            <button 
              onClick=${() => {
                setScore(0);
                setCurrentIdx(0);
                setQuizHistory([]);
                setShowResults(false);
                setSubmitted(false);
                setSelectedOpt('');
              }}
              class="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-all shadow-sm"
            >
              Retake Same Quiz
            </button>
          </div>
        </div>

        <!-- Detailed Review Matrix -->
        <div class="space-y-4">
          <h3 class="font-bold text-slate-900 dark:text-white text-base">Review Answers</h3>
          ${quizHistory.map((item, idx) => html`
            <div key=${idx} class="glass-panel border-l-4 ${item.isCorrect ? 'border-l-emerald-500' : 'border-l-rose-500'} rounded-2xl p-5 shadow-sm space-y-3">
              <div class="flex items-start justify-between gap-4">
                <span class="font-bold text-xs ${item.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">
                  Question ${idx + 1}: ${item.isCorrect ? 'Correct ✓' : 'Incorrect ✗'}
                </span>
              </div>
              <h4 class="font-semibold text-sm text-slate-900 dark:text-white">${item.question}</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div class="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <span class="text-slate-400 font-semibold">Your Answer:</span>
                  <p class="mt-0.5 text-slate-700 dark:text-slate-300">${item.userAnswer}</p>
                </div>
                <div class="p-2 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg">
                  <span class="text-emerald-600 dark:text-emerald-400 font-semibold">Correct Answer:</span>
                  <p class="mt-0.5 text-emerald-800 dark:text-emerald-300 font-medium">${item.correctAnswer}</p>
                </div>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50/30 dark:bg-slate-900/30 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80">
                <span class="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Explanation:</span>
                ${item.explanation}
              </p>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  // Setup / Landing Screen
  if (quizList.length === 0) {
    return html`
      <div class="h-full flex flex-col items-center justify-center p-6 max-w-md mx-auto space-y-6">
        <div class="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-900/50 flex items-center justify-center text-brand-600 dark:text-brand-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        
        <div class="text-center space-y-2">
          <h2 class="text-xl font-bold font-display text-slate-900 dark:text-white">Comprehension Test Generator</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Generate multiple choice questions based on the uploaded research paper or textbook. 
            Test your understanding of methodology, evaluations, formulas, and outcomes.
          </p>
        </div>

        <!-- Configurations -->
        <div class="w-full space-y-4 bg-white/50 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500">Number of Questions</span>
            <div class="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800">
              ${[5, 10, 15].map(n => html`
                <button 
                  key=${n}
                  onClick=${() => setNumQuestions(n)}
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${numQuestions === n ? 'bg-white dark:bg-slate-800 shadow-sm text-brand-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}"
                >
                  ${n}
                </button>
              `)}
            </div>
          </div>
          
          <button 
            onClick=${handleGenerate}
            class="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Generate Quiz
          </button>
        </div>
      </div>
    `;
  }

  // Active Quiz Playing Screen
  const qObj = quizList[currentIdx];

  return html`
    <div class="h-full flex flex-col p-6 overflow-y-auto max-w-3xl mx-auto w-full justify-center">
      <div class="glass-panel rounded-3xl p-6 md:p-8 shadow-md space-y-6">
        
        <!-- Progress Header -->
        <div class="flex justify-between items-center text-xs font-semibold text-slate-400">
          <span>Question ${currentIdx + 1} of ${quizList.length}</span>
          <span>Score: ${score}</span>
        </div>

        <div class="w-full bg-slate-100 dark:bg-slate-900 h-1.5 rounded-full overflow-hidden">
          <div class="bg-brand-500 h-full transition-all duration-300" style="width: ${((currentIdx + 1) / quizList.length) * 100}%"></div>
        </div>

        <!-- Question -->
        <h3 class="text-base md:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
          ${qObj.question}
        </h3>

        <!-- Options list -->
        <div class="space-y-2.5">
          ${qObj.options.map((opt, oIdx) => {
            const letter = chr => String.fromCharCode(65 + chr);
            const isSelected = selectedOpt === opt;
            const isCorrectAnswer = opt === qObj.correct_answer || qObj.correct_answer.includes(opt);
            
            let btnStyle = 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/60 bg-white/50 dark:bg-slate-900/20';
            if (isSelected && !submitted) {
              btnStyle = 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-400 ring-2 ring-brand-500/20';
            }
            if (submitted) {
              if (isCorrectAnswer) {
                btnStyle = 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20';
              } else if (isSelected) {
                btnStyle = 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 ring-2 ring-rose-500/20';
              } else {
                btnStyle = 'border-slate-200 dark:border-slate-800 opacity-60 bg-white/10 dark:bg-slate-900/10';
              }
            }

            return html`
              <button 
                key=${oIdx}
                disabled=${submitted}
                onClick=${() => handleOptionSelect(opt)}
                class="w-full text-left p-4 rounded-xl border text-xs md:text-sm font-medium transition-all flex items-center space-x-3 focus:outline-none ${btnStyle}"
              >
                <div class="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-bold shrink-0">
                  ${letter(oIdx)}
                </div>
                <span>${opt}</span>
              </button>
            `;
          })}
        </div>

        <!-- Feedback & Explanations -->
        ${submitted && html`
          <div class="p-4 rounded-2xl bg-indigo-50/30 dark:bg-indigo-950/15 border border-indigo-100 dark:border-indigo-900/50 space-y-2 text-xs leading-relaxed animate-fade-in">
            <span class="font-bold text-indigo-700 dark:text-indigo-400 block">Explanation:</span>
            <p class="text-slate-600 dark:text-slate-400">${qObj.explanation}</p>
          </div>
        `}

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-2">
          ${!submitted ? html`
            <button 
              disabled=${!selectedOpt}
              onClick=${handleSubmitAnswer}
              class="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              Submit Answer
            </button>
          ` : html`
            <button 
              onClick=${handleNext}
              class="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              ${currentIdx + 1 === quizList.length ? 'Show Results' : 'Next Question'}
            </button>
          `}
        </div>

      </div>
    </div>
  `;
}
