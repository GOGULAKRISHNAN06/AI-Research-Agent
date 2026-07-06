import { html } from '../utils/html.js';

const { useState, useEffect } = window.React;

export default function SettingsView({ apiKey, setApiKey, modelName, setModelName, embeddingType, setEmbeddingType, theme, toggleTheme }) {
  const [keyInput, setKeyInput] = useState(apiKey || '');
  const [modelInput, setModelInput] = useState(modelName || 'gemini-1.5-flash');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setKeyInput(apiKey || '');
  }, [apiKey]);

  useEffect(() => {
    setModelInput(modelName || 'gemini-1.5-flash');
  }, [modelName]);

  const handleSave = (e) => {
    e.preventDefault();
    setApiKey(keyInput);
    setModelName(modelInput);
    localStorage.setItem('gemini_api_key', keyInput);
    localStorage.setItem('gemini_model_name', modelInput);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return html`
    <div class="h-full flex flex-col p-6 overflow-y-auto max-w-4xl mx-auto w-full">
      <div class="mb-6">
        <h1 class="text-3xl font-bold font-display text-slate-900 dark:text-white">Settings</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Configure your assistant, API keys, and workspace preferences.</p>
      </div>

      <div class="space-y-6">
        <!-- API Configuration Panel -->
        <div class="glass-panel rounded-2xl p-6 shadow-sm">
          <div class="flex items-center space-x-3 mb-4">
            <div class="p-2 bg-brand-100 dark:bg-brand-900/50 rounded-lg text-brand-600 dark:text-brand-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.02 5.912 4.75 4.75 0 0 1-1.282-.53l-2.022 2.022a3 3 0 0 1-1.897.802h-1.897A1.125 1.125 0 0 1 2.25 15V13.518a3 3 0 0 1 .802-1.897l2.022-2.022A4.75 4.75 0 0 1 6.09 8.319a6 6 0 0 1 11.66-3.07a3 3 0 0 1 3.25 3.259" />
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-slate-800 dark:text-white">Gemini API Configuration</h2>
              <p class="text-xs text-slate-500">Your configuration is stored locally in your browser and never shared elsewhere.</p>
            </div>
          </div>

          <form onSubmit=${handleSave} class="space-y-4">
            <div>
              <label class="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">Gemini API Key</label>
              <div class="relative">
                <input 
                  type=${showKey ? 'text' : 'password'}
                  value=${keyInput}
                  onChange=${(e) => setKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  class="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                />
                <button 
                  type="button" 
                  onClick=${() => setShowKey(!showKey)}
                  class="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  ${showKey ? html`
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ` : html`
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  `}
                </button>
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">Gemini Model ID</label>
              <input 
                type="text"
                value=${modelInput}
                onChange=${(e) => setModelInput(e.target.value)}
                placeholder="gemini-1.5-flash or custom model name..."
                class="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              />
            </div>

            <div class="flex items-center justify-between">
              <span class="text-xs text-brand-600 dark:text-brand-400 font-medium">
                ${saved && '✓ Settings Saved Successfully!'}
              </span>
              <button 
                type="submit" 
                class="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>

        <!-- Customizations & Settings -->
        <div class="glass-panel rounded-2xl p-6 shadow-sm">
          <h2 class="text-lg font-semibold text-slate-800 dark:text-white mb-4">Application Preferences</h2>
          
          <div class="space-y-4">
            <!-- Theme Toggle -->
            <div class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span class="font-medium text-sm text-slate-800 dark:text-white">Dark Interface Mode</span>
                <p class="text-xs text-slate-500">Toggle dark mode colors and neon accents.</p>
              </div>
              <button 
                onClick=${toggleTheme} 
                class="w-12 h-6 rounded-full p-1 bg-slate-300 dark:bg-brand-600 flex items-center transition-colors duration-300 focus:outline-none"
              >
                <div class="w-4 h-4 rounded-full bg-white transition-transform duration-300 transform dark:translate-x-6"></div>
              </button>
            </div>

            <!-- Embeddings Toggle -->
            <div class="flex items-center justify-between py-2">
              <div>
                <span class="font-medium text-sm text-slate-800 dark:text-white">RAG Embeddings Model</span>
                <p class="text-xs text-slate-500">Select which model creates your document vector index.</p>
              </div>
              <div class="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <button 
                  onClick=${() => setEmbeddingType('local')}
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${embeddingType === 'local' ? 'bg-white dark:bg-slate-800 shadow-sm text-brand-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}"
                >
                  Local (all-MiniLM-L6-v2)
                </button>
                <button 
                  onClick=${() => setEmbeddingType('gemini')}
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${embeddingType === 'gemini' ? 'bg-white dark:bg-slate-800 shadow-sm text-brand-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}"
                >
                  Gemini API
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Documentation & Guide -->
        <div class="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-6">
          <h3 class="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-indigo-600 dark:text-indigo-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            How to get a Gemini API Key?
          </h3>
          <ol class="list-decimal list-inside text-xs text-slate-600 dark:text-slate-400 space-y-2 mt-2 leading-relaxed">
            <li>Visit the <a href="https://aistudio.google.com/" target="_blank" class="text-brand-600 dark:text-brand-400 hover:underline font-semibold">Google AI Studio</a> console.</li>
            <li>Sign in with your Google account.</li>
            <li>Click the <b>"Get API Key"</b> button in the sidebar.</li>
            <li>Create a new key (free-tier accounts have full access to Gemini 1.5 Flash).</li>
            <li>Copy and paste your key in the form above to start using the assistant.</li>
          </ol>
        </div>
      </div>
    </div>
  `;
}
