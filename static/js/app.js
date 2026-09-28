/**
 * EduPath AI - Client Application Logic
 */

let conversationHistory = [];
let currentStep = 'education';

const STEPS = ['education', 'field', 'duration', 'recommendation'];

document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chatForm');
  const userInput = document.getElementById('userInput');
  const restartBtn = document.getElementById('restartBtn');

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (text) {
      sendMessage(text);
      userInput.value = '';
    }
  });

  restartBtn.addEventListener('click', restartAssessment);

  updateProgressBar('education');
});

async function sendMessage(text) {
  appendUserMessage(text);
  conversationHistory.push({ sender: 'user', text: text });
  setLoadingState(true);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: conversationHistory
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const data = await response.json();

    conversationHistory.push({ sender: 'model', text: data.text });
    appendCounselorMessage(data.text, data.payload);

    if (data.payload) {
      if (data.payload.step) {
        updateProgressBar(data.payload.step);
      }
      if (data.payload.quick_replies) {
        updateQuickReplies(data.payload.quick_replies);
      }
      if (data.payload.is_final && data.payload.recommendations && data.payload.recommendations.length > 0) {
        renderRecommendations(data.payload.recommendations);
      }
    }

  } catch (error) {
    console.error('Chat API Error:', error);
    appendCounselorMessage(
      `⚠️ **Connection Notice**: Unable to connect to the counselor engine. Please check your backend server.\n\n*Error details: ${error.message}*`,
      null
    );
  } finally {
    setLoadingState(false);
  }
}

function sendQuickReply(text) {
  const userInput = document.getElementById('userInput');
  userInput.value = text;
  sendMessage(text);
  userInput.value = '';
}

function appendUserMessage(text) {
  const chatHistory = document.getElementById('chatHistory');

  const div = document.createElement('div');
  div.className = 'flex items-start justify-end gap-3 animate-slide-up';
  div.innerHTML = `
    <div class="bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl rounded-tr-none p-4 max-w-xl shadow-md text-sm leading-relaxed">
      <div class="flex items-center justify-end gap-2 mb-1 opacity-80 text-[10px] font-semibold tracking-wide">
        <span>YOU</span>
      </div>
      <p class="whitespace-pre-wrap">${escapeHtml(text)}</p>
    </div>
    <div class="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm font-semibold text-xs">
      <i class="fa-solid fa-user"></i>
    </div>
  `;

  chatHistory.appendChild(div);
  scrollToBottom();
}

function appendCounselorMessage(markdownText, payload) {
  const chatHistory = document.getElementById('chatHistory');
  const htmlContent = typeof marked !== 'undefined' ? marked.parse(markdownText) : markdownText;

  let stepLabel = 'Assessment';
  if (payload && payload.step) {
    if (payload.step === 'education') stepLabel = 'Question 1 of 3: Highest Education';
    else if (payload.step === 'field') stepLabel = 'Question 2 of 3: Field of Study';
    else if (payload.step === 'duration') stepLabel = 'Question 3 of 3: Course Duration';
    else if (payload.step === 'recommendation') stepLabel = 'Final Recommendations';
  }

  const div = document.createElement('div');
  div.className = 'flex items-start gap-3 animate-slide-up';
  div.innerHTML = `
    <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-md">
      <i class="fa-solid fa-robot text-sm"></i>
    </div>
    <div class="bg-white border border-slate-200/90 rounded-2xl rounded-tl-none p-4 max-w-2xl shadow-sm text-sm leading-relaxed text-slate-700">
      <div class="flex items-center gap-2 mb-2">
        <span class="font-bold text-indigo-900 text-xs tracking-wide">AI COUNSELOR</span>
        <span class="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-md border border-indigo-100/80">
          ${stepLabel}
        </span>
      </div>
      <div class="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-indigo-950">
        ${htmlContent}
      </div>
    </div>
  `;

  chatHistory.appendChild(div);
  scrollToBottom();
}

function updateQuickReplies(chipsArray) {
  const container = document.getElementById('quickChipsList');
  if (!container || !Array.isArray(chipsArray)) return;

  container.innerHTML = '';

  chipsArray.forEach(chipText => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-chip px-3.5 py-1.5 text-xs font-medium bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 rounded-full shadow-sm transition-all flex items-center gap-1.5';
    btn.onclick = () => sendQuickReply(chipText);
    btn.innerHTML = `<i class="fa-solid fa-reply text-[10px] text-indigo-500"></i> ${escapeHtml(chipText)}`;
    container.appendChild(btn);
  });
}

function updateProgressBar(stepName) {
  currentStep = stepName;
  const idx = STEPS.indexOf(stepName);
  const activeIndex = idx >= 0 ? idx : 0;

  const percentage = (activeIndex / (STEPS.length - 1)) * 100;
  const fillBar = document.getElementById('progressFill');
  if (fillBar) {
    fillBar.style.width = `${percentage}%`;
  }

  STEPS.forEach((s, index) => {
    const nodeElem = document.getElementById(`stepNode-${s}`);
    if (!nodeElem) return;

    const circle = nodeElem.querySelector('.node-circle');
    const label = nodeElem.querySelector('span');

    if (index < activeIndex) {
      circle.className = 'node-circle w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-md transition-all';
      circle.innerHTML = '<i class="fa-solid fa-check"></i>';
      label.className = 'text-xs font-semibold text-emerald-700 mt-2';
    } else if (index === activeIndex) {
      circle.className = 'node-circle w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md transition-all step-active';
      circle.innerHTML = getStepIconHtml(s);
      label.className = 'text-xs font-bold text-indigo-700 mt-2';
    } else {
      circle.className = 'node-circle w-10 h-10 rounded-full bg-slate-100 text-slate-400 border-2 border-slate-200 flex items-center justify-center font-bold text-sm transition-all';
      circle.innerHTML = getStepIconHtml(s);
      label.className = 'text-xs font-medium text-slate-400 mt-2';
    }
  });
}

function getStepIconHtml(step) {
  switch (step) {
    case 'education': return '<i class="fa-solid fa-graduation-cap"></i>';
    case 'field': return '<i class="fa-solid fa-book-bookmark"></i>';
    case 'duration': return '<i class="fa-solid fa-clock"></i>';
    case 'recommendation': return '<i class="fa-solid fa-award"></i>';
    default: return '<i class="fa-solid fa-circle"></i>';
  }
}

function renderRecommendations(recs) {
  const section = document.getElementById('recommendationSection');
  const list = document.getElementById('recommendationsList');

  if (!section || !list) return;

  list.innerHTML = '';

  recs.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'glass-card rounded-2xl p-5 border border-indigo-100 hover:shadow-xl hover:border-indigo-300 transition-all flex flex-col justify-between relative overflow-hidden group';

    const platformLower = (item.platform || '').toLowerCase();
    let badgeClass = 'badge-default';
    if (platformLower.includes('coursera')) badgeClass = 'badge-coursera';
    else if (platformLower.includes('edx')) badgeClass = 'badge-edx';
    else if (platformLower.includes('udemy')) badgeClass = 'badge-udemy';
    else if (platformLower.includes('nptel')) badgeClass = 'badge-nptel';

    const skillsHtml = Array.isArray(item.skills) 
      ? item.skills.map(s => `<span class="px-2.5 py-1 text-[11px] font-medium bg-slate-100 text-slate-700 rounded-md border border-slate-200/60">${escapeHtml(s)}</span>`).join('')
      : '';

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-2 mb-3">
          <span class="px-3 py-1 rounded-full text-xs font-bold ${badgeClass} shadow-sm flex items-center gap-1.5">
            <i class="fa-solid fa-globe text-[10px]"></i> ${escapeHtml(item.platform || 'Online Course')}
          </span>
          <span class="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
            Match #${i + 1}
          </span>
        </div>

        <h3 class="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug mb-3">
          ${escapeHtml(item.title)}
        </h3>

        <div class="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 mb-4">
          <div class="flex items-center gap-1.5 text-xs font-bold text-indigo-900 mb-1">
            <i class="fa-solid fa-lightbulb text-amber-500"></i>
            <span>Why this matches your answers:</span>
          </div>
          <p class="text-xs text-slate-600 leading-relaxed">
            ${escapeHtml(item.match_reason || 'Matches your education, field of interest, and duration preference.')}
          </p>
        </div>

        <div class="mb-4">
          <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Key Skills</span>
          <div class="flex flex-wrap gap-1.5">
            ${skillsHtml}
          </div>
        </div>
      </div>

      <a 
        href="${escapeHtml(item.link || '#')}" 
        target="_blank" 
        rel="noopener noreferrer" 
        class="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 group-hover:shadow-indigo-200 transition-all"
      >
        <span>Explore Course Details</span>
        <i class="fa-solid fa-arrow-up-right-from-square text-[11px]"></i>
      </a>
    `;

    list.appendChild(card);
  });

  section.classList.remove('hidden');

  setTimeout(() => {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);
}

function restartAssessment() {
  conversationHistory = [];
  currentStep = 'education';

  const chatHistory = document.getElementById('chatHistory');
  chatHistory.innerHTML = `
    <div class="flex items-start gap-3 animate-slide-up">
      <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-md">
        <i class="fa-solid fa-robot text-sm"></i>
      </div>
      <div class="bg-white border border-slate-200/90 rounded-2xl rounded-tl-none p-4 max-w-2xl shadow-sm text-sm leading-relaxed text-slate-700">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="font-bold text-indigo-900 text-xs tracking-wide">AI COUNSELOR</span>
          <span class="text-[10px] bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-md border border-indigo-100">Step 1 of 3</span>
        </div>
        <p>Hello! 👋 Assessment restarted. Let's find your ideal course in 3 quick questions:</p>
        <p class="mt-2 font-semibold text-slate-900">1. What is the highest education level you have completed or are currently pursuing?</p>
      </div>
    </div>
  `;

  const recSection = document.getElementById('recommendationSection');
  if (recSection) recSection.classList.add('hidden');

  updateProgressBar('education');

  updateQuickReplies([
    'High School / Senior Secondary',
    'Bachelor\'s Degree (B.Tech / B.Sc / B.A)',
    'Master\'s Degree (M.Tech / M.Sc / MBA)',
    'Doctorate / Working Professional'
  ]);
}

function setLoadingState(isLoading) {
  const sendBtn = document.getElementById('sendBtn');
  const userInput = document.getElementById('userInput');
  const indicator = document.getElementById('typingIndicator');

  if (isLoading) {
    sendBtn.disabled = true;
    userInput.disabled = true;
    if (indicator) indicator.classList.remove('hidden');
  } else {
    sendBtn.disabled = false;
    userInput.disabled = false;
    userInput.focus();
    if (indicator) indicator.classList.add('hidden');
  }
}

function scrollToBottom() {
  const chatHistory = document.getElementById('chatHistory');
  if (chatHistory) {
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }
}

function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
