// --- Test version: no API calls, fixed movie title ---
const wordContainer = document.getElementById('word-container');
const keyboardEl = document.getElementById('keyboard');
const msg = document.getElementById('message');
const poster = document.getElementById('poster');
const yearEl = document.getElementById('year');
const genresEl = document.getElementById('genres');

let movie = {
  title: 'The Martian',
  normalized: 'THE MARTIAN',
  year: '2015',
  genres: ['Adventure', 'Drama', 'Sci-Fi'],
  poster: 'https://image.tmdb.org/t/p/w500/5aGhaIHYuQbqlHWvWYqMCnj40y2.jpg'
};

let revealed = [];
let wrongGuesses = 0;
const maxWrong = 6;

function renderWord() {
  wordContainer.innerHTML = '';
  revealed = movie.normalized.split('').map(ch => (ch === ' ' ? ' ' : '_'));

  movie.normalized.split('').forEach(ch => {
    const box = document.createElement('div');
    box.classList.add('letter-box');
    if (ch === ' ') {
      box.classList.add('space');
      box.textContent = '';
    } else {
      box.textContent = '_';
    }
    wordContainer.appendChild(box);
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
      btn.onclick = () => handleLetter(letter, btn);
      rowEl.appendChild(btn);
    }
    keyboardEl.appendChild(rowEl);
  });
}

function handleLetter(letter, btn) {
  btn.disabled = true;

  const upper = letter.toUpperCase();
  const target = movie.normalized;

  if (target.includes(upper)) {
    btn.classList.add('correct');
    target.split('').forEach((ch, i) => {
      if (ch === upper) {
        revealed[i] = upper;
        const box = wordContainer.children[i];
        box.textContent = upper;
        box.classList.add('reveal');
      }
    });
    checkWin();
  } else {
    btn.classList.add('wrong');
    wrongGuesses++;
    updateHints();
    checkLose();
  }
}

function updateHints() {
  if (wrongGuesses >= 3) yearEl.textContent = movie.year;
  if (wrongGuesses >= 4) genresEl.textContent = movie.genres.join(', ');
  poster.src = movie.poster;
  poster.style.filter = `blur(${Math.max(20 - wrongGuesses * 4, 0)}px)`;
}

function checkWin() {
  if (!revealed.includes('_')) {
    msg.textContent = `🎉 You guessed it! "${movie.title}"`;
    msg.classList.remove('lose');
    msg.classList.add('win');
    disableAllKeys();
  }
}

function checkLose() {
  if (wrongGuesses >= maxWrong) {
    msg.textContent = `😢 Out of tries! The movie was "${movie.title}"`;
    msg.classList.remove('win');
    msg.classList.add('lose');
    disableAllKeys();
  }
}

function disableAllKeys() {
  document.querySelectorAll('.key').forEach(k => (k.disabled = true));
}

// Initialize
poster.src = movie.poster;
renderWord();
renderKeyboard();
