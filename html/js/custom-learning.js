// Custom Learning Process Logic
// Author: AI

// Configurable: which views to disable (by default, none)
const customLearningConfig = {
    disableLearn: false,
    disableRepeat: false,
    disableRepeatAudio: false,
    disableWrite: false
};

// Parse disable flags from URL (?disable=write,repeat)
(function parseDisableFlags() {
    const params = new URLSearchParams(window.location.search);
    const disable = params.get('disable');
    if (disable) {
        const disables = disable.split(',');
        customLearningConfig.disableLearn = disables.includes('learn');
        customLearningConfig.disableRepeat = disables.includes('repeat');
        customLearningConfig.disableRepeatAudio = disables.includes('repeat-audio');
        customLearningConfig.disableWrite = disables.includes('write');
    }
})();

// Main process
const app = document.getElementById('customLearningApp');
const categoryId = new URLSearchParams(window.location.search).get('category_id');

let words = [];
let stepQueue = [];
let currentStep = 0;
const BATCH_SIZE = 2;

async function fetchWords() {
    // Fetch words for the category (API endpoint may need adjustment)
    const token = localStorage.getItem('auth_token');
    const userLanguage = localStorage.getItem('user_language') || 'kk';
    const resp = await fetch(`/api/categories/${categoryId}/words?language_code=${userLanguage}&skip=0&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) throw new Error('Failed to fetch words');
    words = await resp.json();
}

function buildStepQueue() {
    stepQueue = [];
    for (let i = 0; i < words.length; i += BATCH_SIZE) {
        const batch = words.slice(i, i + BATCH_SIZE);
        // Learn
        if (!customLearningConfig.disableLearn) stepQueue.push({ type: 'learn', batch });
        // Repeat
        if (!customLearningConfig.disableRepeat) stepQueue.push({ type: 'repeat', batch });
        // After first batch, add repeat-audio and write for previous batches
        if (i > 0) {
            const prevBatch = words.slice(i - BATCH_SIZE, i);
            if (!customLearningConfig.disableRepeatAudio) stepQueue.push({ type: 'repeat-audio', batch: prevBatch });
            if (!customLearningConfig.disableWrite) stepQueue.push({ type: 'write', batch: prevBatch });
        }
    }
    // After all batches, add repeat-audio and write for last batch
    const lastBatch = words.slice(words.length - BATCH_SIZE, words.length);
    if (!customLearningConfig.disableRepeatAudio) stepQueue.push({ type: 'repeat-audio', batch: lastBatch });
    if (!customLearningConfig.disableWrite) stepQueue.push({ type: 'write', batch: lastBatch });
}

function goToStep(idx) {
    currentStep = idx;
    if (currentStep >= stepQueue.length) {
        app.innerHTML = `<div class='custom-learning-complete'>🎉 Custom learning complete!</div>`;
        return;
    }
    const step = stepQueue[currentStep];
    // Render navigation and iframe
    app.innerHTML = `
        <div class='custom-learning-nav'>
            <button ${currentStep === 0 ? 'disabled' : ''} onclick='window.customLearningPrevStep()'>Prev</button>
            <span>Step ${currentStep + 1} of ${stepQueue.length} (${step.type})</span>
            <button ${currentStep === stepQueue.length - 1 ? 'disabled' : ''} onclick='window.customLearningNextStep()'>Next</button>
        </div>
        <iframe id='customLearningFrame' src='${getStepUrl(step)}' style='width:100%;height:600px;border:none;margin-top:1rem;'></iframe>
    `;
}

function getStepUrl(step) {
    const ids = step.batch.map(w => w.id).join(',');
    switch (step.type) {
        case 'learn': return `learn.html?word_ids=${ids}`;
        case 'repeat': return `repeat.html?word_ids=${ids}`;
        case 'repeat-audio': return `repeat-audio.html?word_ids=${ids}`;
        case 'write': return `write.html?word_ids=${ids}`;
        default: return '';
    }
}

window.customLearningPrevStep = function() {
    if (currentStep > 0) goToStep(currentStep - 1);
};
window.customLearningNextStep = function() {
    if (currentStep < stepQueue.length - 1) goToStep(currentStep + 1);
};

// Main init
(async function initCustomLearning() {
    app.innerHTML = 'Loading words...';
    try {
        await fetchWords();
        if (!words.length) {
            app.innerHTML = '<div>No words found for this category.</div>';
            return;
        }
        buildStepQueue();
        goToStep(0);
    } catch (e) {
        app.innerHTML = `<div style='color:red;'>${e.message}</div>`;
    }
})(); 