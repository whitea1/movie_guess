// === Movie Guess (TMDb live version) ===
// Replace API_KEY with your key (you already have it in this variable)
const API_KEY = 'ac2186479d3af56f901e4687edb7ba94';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

// DOM refs
const wordContainer = document.getElementById('word-container');
const keyboardEl = document.getElementById('keyboard');
const msg = document.getElementById('message');
const poster = document.getElementById('poster');
const yearEl = document.getElementById('year');
const genresEl = document.getElementById('genres');

// modal / stats DOM (may be null if HTML missing)
const modal = document.getElementById('result-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const shareBtn = document.getElementById('share-button');
const closeBtn = document.getElementById('close-modal');
const streakInfo = document.getElementById('streak-info');

const openStatsBtn = document.getElementById('open-stats');
const statsModal = document.getElementById('stats-modal');
const statsBody = document.getElementById('stats-body');
const closeStatsBtn = document.getElementById('close-stats');
const resetStatsBtn = document.getElementById('reset-stats');

let hintStage = 0; // 0 = none used, 1 = used first, 2 = used second, 3 = poster shown
const hintButton = document.getElementById('hint-button');
const hintModal = document.getElementById('hint-modal');
const hintText = document.getElementById('hint-text');
const hintTitle = document.getElementById('hint-title');
const closeHint = document.getElementById('close-hint');


// Game state
let movie = null;
let revealed = [];
let wrongGuesses = 0;
let guessedLetters = new Set();
const maxWrong = 10;

// ---------------- helpers ----------------
function normalize(str) {
  return (str || '').replace(/[^A-Z0-9 ]/gi, '').toUpperCase();
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------- persistence ----------------
function saveProgress() {
  try {
    const state = {
      movie,
      revealed,
      wrongGuesses,
      guessedLetters: Array.from(guessedLetters),
      date: todayKey(),
      livesRemaining: Math.max(0, maxWrong - wrongGuesses),
      completed: !revealed.includes('_') || wrongGuesses >= maxWrong,
      hintStage

    };
    localStorage.setItem('movieGuessState', JSON.stringify(state));
    console.log('⚡ Progress saved');
  } catch (e) {
    console.warn('Could not save progress', e);
  }
}

function loadProgress() {
  const saved = localStorage.getItem('movieGuessState');
  if (!saved) return null;
  try {
    const data = JSON.parse(saved);
    if (data.date !== todayKey()) return null; // new day → reset
    return data;
  } catch (e) {
    console.warn('Failed to parse saved progress', e);
    return null;
  }
}

// Stats persistence
function loadStats() {
  const stats = JSON.parse(localStorage.getItem('movieGuessStats') || '{}');
  return {
    currentStreak: stats.currentStreak || 0,
    bestStreak: stats.bestStreak || 0,
    lastWinDate: stats.lastWinDate || null,
    totalWins: stats.totalWins || 0,
    totalLosses: stats.totalLosses || 0,
    guessDistribution: stats.guessDistribution || [0, 0, 0, 0, 0, 0],
    totalPoints: stats.totalPoints || 0
  };
}
function saveStats(stats) {
  localStorage.setItem('movieGuessStats', JSON.stringify(stats));
}

// ---------------- UI update functions ----------------
function updateLives() {
  const remaining = Math.max(0, maxWrong - wrongGuesses);
  const el = document.getElementById('lives-count');
  if (el) el.textContent = remaining;
}

function renderWord() {
  wordContainer.innerHTML = '';
  if (!movie || !revealed) return;

  const words = movie.normalized.split(' ');
  let letterIndex = 0;

  words.forEach((word, wordIdx) => {
    const wordGroup = document.createElement('div');
    wordGroup.classList.add('word-group');

    for (let i = 0; i < word.length; i++) {
      const box = document.createElement('div');
      box.classList.add('letter-box');

      // reveal the correct letter from the revealed array
      const ch = revealed[letterIndex];
      box.textContent = ch === '_' ? '' : ch;

      wordGroup.appendChild(box);
      letterIndex++;
    }

    // skip the space in the revealed array *only if there’s another word after*
    if (wordIdx < words.length - 1) letterIndex++;

    wordContainer.appendChild(wordGroup);
  });
}





function renderKeyboard() {
  keyboardEl.innerHTML = '';
  const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  rows.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.classList.add('key-row');
    for (const letter of row) {
      const btn = document.createElement('button');
      btn.textContent = letter;
      btn.classList.add('key');

      // use lower-case in guessedLetters set
      if (guessedLetters.has(letter.toLowerCase())) {
        btn.disabled = true;
        if (movie && movie.normalized.includes(letter)) btn.classList.add('correct');
        else btn.classList.add('wrong');
      }

      btn.onclick = () => handleLetter(letter, btn);
      rowEl.appendChild(btn);
    }
    keyboardEl.appendChild(rowEl);
  });
}

function updateHints() {
  if (!movie) return;
  if (wrongGuesses >= 3 && yearEl) yearEl.textContent = movie.year || 'Unknown';
  if (wrongGuesses >= 4 && genresEl) genresEl.textContent = movie.genres ? movie.genres.join(', ') : 'Unknown';
  if (poster) poster.style.filter = `blur(${Math.max(20 - wrongGuesses * 4, 0)}px)`;
}

function disableAllKeys() {
  document.querySelectorAll('.key').forEach(k => (k.disabled = true));
}

// ---------------- core gameplay ----------------
function handleLetter(letter, btn) {
  const lower = letter.toLowerCase();
  if (guessedLetters.has(lower)) return;
  guessedLetters.add(lower);
  if (btn) { btn.disabled = true; }

  const upper = letter.toUpperCase();
  const target = movie.normalized;

  if (target.includes(upper)) {
    if (btn) btn.classList.add('correct');
    target.split('').forEach((ch, i) => {
      if (ch === upper) {
        revealed[i] = upper;
        const box = wordContainer.children[i];
        if (box) {
          box.textContent = upper;
          box.classList.add('reveal');
        }
      }
    });
    saveProgress();
    renderWord();
    checkWin();
  } else {
    if (btn) btn.classList.add('wrong');
    wrongGuesses++;
    updateLives();
    saveProgress();
    updateHints();
    checkLose();
  }
}

function disableHints() {
  hintButton.disabled = true;
  hintButton.style.opacity = '0.5';
  hintButton.style.cursor = 'not-allowed';
}


// win/lose check (safe, only count once per day)
function checkWin() {
  if (!revealed.includes('_')) {
    msg.classList.remove('lose'); msg.classList.add('win');
    disableAllKeys();
    disableHints();
    saveProgress();
    


    const stats = loadStats();
    const today = todayKey();
    if (stats.lastWinDate !== today) {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = yesterday.toISOString().slice(0,10);
      if (stats.lastWinDate === yesterdayKey) stats.currentStreak++;
      else stats.currentStreak = 1;
      stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
      stats.lastWinDate = today;
      const livesRemaining = Math.max(maxWrong - wrongGuesses, 0);
      stats.totalWins++;
      stats.totalPoints = (stats.totalPoints || 0) + livesRemaining; // ✅ add points
      const index = Math.min(wrongGuesses, 5);
      stats.guessDistribution[index]++;
      saveStats(stats);
      
    }
    showModal(true);
  }
}

function checkLose() {
  if (wrongGuesses >= maxWrong) {
    msg.classList.remove('win'); msg.classList.add('lose');
    disableAllKeys();
    disableHints();
    saveProgress();
    


    const stats = loadStats();
    stats.totalLosses++;
    saveStats(stats);

    showModal(false);
  }
}

// ---------------- modal & sharing ----------------
function showModal(won) {
  modal.classList.remove('hidden');
  disableHints();
  const stats = loadStats();

  // Calculate lives remaining
  const livesRemaining = Math.max(maxWrong - wrongGuesses, 0);

  if (won) {
    modalTitle.textContent = 'You Win!';
    const pointsEarned = Math.max(maxWrong - wrongGuesses, 0);
    modalMessage.textContent = `You guessed "${movie.title}" and earned ${pointsEarned} points!`;
    streakInfo.innerHTML = `Total Points: <strong>${stats.totalPoints}</strong><br>
                            Current Streak: ${stats.currentStreak}<br>
                            Best Streak: ${stats.bestStreak}`;
  
  
  } else {
    modalTitle.textContent = 'Oh no! Better Luck Tomorrow';
    streakInfo.textContent = `Current streak: ${stats.currentStreak}<br>
                              Best: ${stats.bestStreak}`;
  }

  shareBtn.onclick = shareResult;
}

if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');
if (msg.classList.contains('win') || msg.classList.contains('lose')) {
  disableAllKeys();
}

function generateShareGrid() {
  const target = movie.normalized;
  const grid = [];

  for (const letter of guessedLetters) {
    const upper = letter.toUpperCase();
    if (target.includes(upper)) grid.push('🟩');
    else grid.push('🟥');
  }

  if (grid.length === 0) return 'No guesses made yet!';
  return grid.join(''); // single line, in guess order
}


function shareResult(won) {
  const emojiGrid = generateShareGrid();
  const livesRemaining = Math.max(maxWrong - wrongGuesses, 0);
  const hintsUsed = Math.min(hintStage, 3); // 0–3 hints possible
  const pointsEarned = Math.max(maxWrong - wrongGuesses, 0);
  const stats = loadStats();
  const shareText =
    `🎬 Daily Movie Quiz ${todayKey()}\n` +
    `${won ? `WON — ${pointsEarned} points earned` : 'LOST'}\n` +
    `${emojiGrid}\n` +
    `Total Points: ${stats.totalPoints}\n` +
    `Play at: https://www.thedmq.com`;
  
  
  
  if (navigator.share) navigator.share({ text: shareText }).catch(()=>{});
  else { navigator.clipboard.writeText(shareText); alert('📋 Result copied to clipboard!'); }
}
if (shareBtn) shareBtn.onclick = () => shareResult(won);


// ---------------- stats modal controls ----------------
if (openStatsBtn) {
  openStatsBtn.onclick = (event) => {
    const stats = loadStats();
    const totalGames = stats.totalWins + stats.totalLosses;
    const winPct = totalGames ? ((stats.totalWins / totalGames) * 100).toFixed(1) : 0;

    // show reset only when shift held
    if (resetStatsBtn) {
      resetStatsBtn.style.display = event.shiftKey ? 'inline-block' : 'none';
    }

    const dist = stats.guessDistribution;
    const maxCount = Math.max(...dist, 1);
    const bars = dist.map((count,i) => {
      if (count === 0) return '';
      return `<div class="bar-row"><span>${i+1}</span><div class="bar" data-width="${(count/maxCount)*100}" style="width:0%"></div><span class="bar-count">${count}</span></div>`;
    }).join('') || '<p class="empty-stats">No data yet — start guessing!</p>';

    statsBody.innerHTML = `
      <p style="text-align:center; font-size:1.2em; color:#ffcc00; margin:0.5em 0;"><strong>${stats.totalPoints}</strong></p>
      <p>Current Streak: <strong>${stats.currentStreak}</strong></p>
      <p>Best Streak: <strong>${stats.bestStreak}</strong></p>
      <p>Total Wins: <strong>${stats.totalWins}</strong></p>
      <p>Total Losses: <strong>${stats.totalLosses}</strong></p>
      <p>Win Rate: <strong>${winPct}%</strong></p>
      <h3 style="margin-top:1em;">Guess Distribution</h3>
      <div id="guess-graph">${bars}</div>
    `;
    if (statsModal) statsModal.classList.remove('hidden');

    // animate bars a bit after show
    setTimeout(()=> {
      document.querySelectorAll('.bar').forEach(bar => {
        const target = bar.dataset.width;
        bar.style.width = `${target}%`;
      });
    }, 200);
  };
}
if (closeStatsBtn) closeStatsBtn.onclick = () => statsModal.classList.add('hidden');
if (msg.classList.contains('win') || msg.classList.contains('lose')) {
  disableAllKeys();
}
if (resetStatsBtn) {
  resetStatsBtn.onclick = () => {
    if (confirm('Reset stats?')) {
      localStorage.removeItem('movieGuessStats');
      alert('Stats reset');
      if (statsModal) statsModal.classList.add('hidden');
    }
  };
}

hintButton.onclick = () => {
  if (!movie) return;

  // Stage 0 → show year
  if (hintStage === 0) {
    if (wrongGuesses >= maxWrong - 1) return alert("You don't have enough lives!");
    wrongGuesses+=2;
    updateLives();
    hintStage = 1;
    hintButton.textContent = 'Hint 2';
    hintTitle.textContent = 'Hint 1';
    hintText.textContent = `Released in ${movie.year}`;
    showHintModal();
  }

  // Stage 1 → show genres
  else if (hintStage === 1) {
    if (wrongGuesses >= maxWrong - 1) return alert("You don't have enough lives!");
    wrongGuesses+=3;
    updateLives();
    hintStage = 2;
    hintButton.textContent = 'Poster';
    hintTitle.textContent = 'Hint 2';
    hintText.textContent = `Genres: ${movie.genres.join(', ')}`;
    showHintModal();
  }

  // Stage 2 → reveal poster (all but 1 life lost)
  else if (hintStage === 2) {
    if (wrongGuesses < maxWrong - 1) {
      wrongGuesses = maxWrong - 1; // leave only 1 life
    }
    updateLives();
    hintStage = 3;
    hintButton.disabled = true; // no more hints
    hintTitle.textContent = 'Poster Hint';
    hintText.innerHTML = `<img src="${movie.poster}" alt="Movie Poster" style="max-width:100%;border-radius:12px;">`;
    showHintModal();
  }

  saveProgress();
};

function showHintModal() {
  hintModal.classList.remove('hidden');
}

closeHint.onclick = () => {
  hintModal.classList.add('hidden');
};


// ---------------- keyboard support ----------------
document.addEventListener('keydown', (e) => {
  const letter = e.key.toUpperCase();
  if (!/^[A-Z]$/.test(letter)) return;
  if (guessedLetters.has(letter.toLowerCase())) return;
  if (msg.classList.contains('win') || msg.classList.contains('lose')) return;
  const button = Array.from(document.querySelectorAll('.key')).find(b => b.textContent === letter);
  if (button) {
    button.classList.add('pressed'); setTimeout(()=>button.classList.remove('pressed'),100);
    handleLetter(letter, button);
  }
});

// ---------------- fetch / bootstrap ----------------
async function fetchMovie() {
  msg.textContent = '🎬 Loading movie...';
  console.log('🔄 fetchMovie start');

  try {
    const saved = loadProgress();
    console.log('Loaded saved:', saved);
    if (saved && saved.movie && saved.movie.title) {
      console.log('🔁 Restoring saved progress...');
    
      movie = saved.movie;
      revealed = saved.revealed || [];
      wrongGuesses = saved.wrongGuesses || 0;
      guessedLetters = new Set(saved.guessedLetters || []);

      setTimeout (() => {
        renderWord();
        renderKeyboard();
        updateLives();
      }, 0)

      // ✅ Restore hint stage from saved progress
      hintStage = saved.hintStage || 0;

      // Restore button label based on hint progress
      if (hintStage === 1) hintButton.textContent = 'Hint 2';
      else if (hintStage === 2) hintButton.textContent = 'Poster';
      else if (hintStage >= 3) {
        hintButton.textContent = 'Poster';
        hintButton.disabled = true;
      }


      // disableAllKeys();
    
      // ✅ Already won
      if (!revealed.includes('_')) {
        msg.textContent = '✅ You already solved today’s movie!';
        msg.classList.add('win');
        disableAllKeys();
        showModal(true);
        return; // Stop here
      }
    
      // ✅ Already lost
      if (saved.livesRemaining !== undefined && saved.livesRemaining <= 0) {
        msg.textContent = '💀 You’ve used all your lives.';
        msg.classList.add('lose');
        disableAllKeys();
        showModal(false);
        return; // Stop here
      }
    
      // ✅ Otherwise resume game
      msg.textContent = 'Continue guessing!';
      console.log('✅ Loaded saved game from today');
      return; // Stop before fetching TMDB again
    }
    
    

    console.log('🌐 No saved state — fetching TMDB');
    const res = await fetch(`${TMDB_BASE}/movie/popular?api_key=${API_KEY}&language=en-US&page=1`);
    console.log('TMDB response status:', res.status);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`TMDB fetch failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    const movies = data.results;
    if (!movies || movies.length === 0) throw new Error('No movies returned from TMDB');

    const seed = parseInt(todayKey().replace(/-/g,''), 10);
    const index = seed % movies.length;
    const m = movies[index];

    const detailsRes = await fetch(`${TMDB_BASE}/movie/${m.id}?api_key=${API_KEY}&language=en-US`);
    if (!detailsRes.ok) {
      const text = await detailsRes.text();
      throw new Error(`TMDB details fetch failed: ${detailsRes.status} ${text}`);
    }
    const details = await detailsRes.json();

    movie = {
      title: m.title,
      normalized: normalize(m.title),
      year: details.release_date?.slice(0,4),
      genres: (details.genres || []).map(g => g.name),
      poster: m.poster_path ? POSTER_BASE + m.poster_path : ''
    };

    // initialize game state
    revealed = movie.normalized.split('').map(ch => (ch === ' ' ? ' ' : '_'));
    wrongGuesses = 0;
    guessedLetters = new Set();

    // init UI
    if (typeof poster !== 'undefined' && poster) {
      poster.src = movie.poster;
    }    
    renderWord();
    renderKeyboard();
    updateHints();
    updateLives();

    // ✅ re-enable hint button for new day
    hintButton.disabled = false;
    hintButton.style.opacity = '1';
    hintButton.style.cursor = 'pointer';


    msg.textContent = 'Guess the movie of the day!';
    saveProgress();

    console.log('🎬 New daily movie loaded:', movie.title);
  } catch (err) {
    msg.textContent = '❌ Error fetching movie. Check your API key or connection.';
    console.error('FetchMovie error:', err);
  }
}

fetchMovie();
