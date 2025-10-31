import fs from 'fs';
import fetch from 'node-fetch';

const API_KEY = 'ac2186479d3af56f901e4687edb7ba94';
const TMDB_BASE = 'https://api.themoviedb.org/3';

async function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function fetchMovies() {
  const allMovies = [];

  console.log('🎬 Starting TMDb fetch for 365 movies (English only, no numbers)...');

  // Fetch multiple pages of popular movies
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${TMDB_BASE}/movie/popular?api_key=${API_KEY}&language=en-US&page=${page}`);
    if (!res.ok) {
      console.error(`❌ Failed to fetch page ${page}:`, res.status);
      continue;
    }

    const data = await res.json();
    if (data.results && data.results.length) {
      allMovies.push(...data.results);
      console.log(`📄 Fetched page ${page} (${data.results.length} movies)`);
    }
    await delay(250);
  }

  // ✅ Filter for English-language movies without numbers in the title
  const filteredMovies = allMovies.filter(m => 
    m.original_language === 'en' && !/\d/.test(m.title)
  );

  const uniqueMovies = Array.from(new Map(filteredMovies.map(m => [m.id, m])).values());
  console.log(`✅ Collected ${uniqueMovies.length} unique English movies (no numbers)`);

  // Shuffle and pick 365
  const selected = uniqueMovies.sort(() => 0.5 - Math.random()).slice(0, 365);
  const detailed = [];

  console.log('🎞 Fetching detailed data (with genres)...');
  for (let i = 0; i < selected.length; i++) {
    const m = selected[i];
    const detailsRes = await fetch(`${TMDB_BASE}/movie/${m.id}?api_key=${API_KEY}&language=en-US`);
    if (!detailsRes.ok) {
      console.warn(`⚠️ Skipping movie ${m.title} (${m.id})`);
      continue;
    }

    const details = await detailsRes.json();

    // double-check again before saving
    if (details.original_language !== 'en' || /\d/.test(details.title)) {
      console.log(`🚫 Skipping non-English or numbered title: "${details.title}"`);
      continue;
    }

    detailed.push({
      id: m.id,
      title: details.title,
      year: details.release_date?.slice(0, 4),
      genres: (details.genres || []).map(g => g.name),
      poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : ''
    });

    if (i % 10 === 0) console.log(`🎬 Processed ${i + 1}/${selected.length}`);
    await delay(250);
  }

  fs.writeFileSync('movies.json', JSON.stringify(detailed, null, 2));
  console.log(`🎉 Done! Saved ${detailed.length} English-only, number-free movies (with genres) to movies.json`);
}

fetchMovies().catch(err => console.error('💀 Error:', err));
