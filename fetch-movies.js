import fs from "fs";
import fetch from "node-fetch";

const API_KEY = "ac2186479d3af56f901e4687edb7ba94";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TARGET_COUNT = 365;

//
// ----------- RATE LIMIT HANDLER -----------
//
let lastRequestTime = 0;
const MIN_DELAY = 300; // ~3 requests per second (safe)

async function safeFetch(url, attempts = 3) {
  const now = Date.now();
  const wait = Math.max(0, MIN_DELAY - (now - lastRequestTime));

  if (wait > 0) await new Promise(res => setTimeout(res, wait));

  lastRequestTime = Date.now();

  try {
    const res = await fetch(url);

    if (!res.ok) {
      if (attempts > 1) return await safeFetch(url, attempts - 1);
      console.error(`❌ Request failed (${res.status}): ${url}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    if (attempts > 1) return await safeFetch(url, attempts - 1);
    console.error("❌ Network failure:", err.message);
    return null;
  }
}

//
// ----------- MAIN SCRIPT -----------
//
async function fetchMovies() {
  console.log("🎬 Fetching English movies with no numbers…");

  let pool = [];

  //
  // 📌 STEP 1 — Fetch 20 pages of popular movies
  //
  for (let page = 1; page <= 20; page++) {
    const data = await safeFetch(
      `${TMDB_BASE}/movie/popular?api_key=${API_KEY}&language=en-US&page=${page}`
    );

    if (data?.results?.length) {
      pool.push(...data.results);
      console.log(`📄 Popular page ${page}/20 fetched (${data.results.length} movies)`);
    }
  }

  //
  // 📌 STEP 2 — Filter English, remove titles with digits
  //
  pool = pool.filter(
    m => m.original_language === "en" && !/\d/.test(m.title)
  );

  // Remove duplicates
  pool = Array.from(new Map(pool.map(m => [m.id, m])).values());

  console.log(`🔎 Initial filtered pool: ${pool.length} movies`);

  //
  // 📌 STEP 3 — If not enough, use Discover to expand the pool
  //
  if (pool.length < TARGET_COUNT) {
    console.log("➕ Expanding database using Discover…");

    for (let page = 1; page <= 30 && pool.length < TARGET_COUNT * 2; page++) {
      const data = await safeFetch(
        `${TMDB_BASE}/discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&page=${page}&with_original_language=en`
      );

      if (data?.results?.length) {
        pool.push(...data.results);
        pool = pool.filter(m => !/\d/.test(m.title));
        pool = Array.from(new Map(pool.map(m => [m.id, m])).values());

        console.log(`🔎 Discover page ${page}/30 → pool = ${pool.length}`);
      }
    }
  }

  if (pool.length < TARGET_COUNT) {
    console.error("❌ Could not collect enough valid movies.");
    process.exit(1);
  }

  //
  // 📌 STEP 4 — Shuffle and take more than needed
  //
  const selected = pool
    .sort(() => Math.random() - 0.5)
    .slice(0, TARGET_COUNT + 40); // extra in case of failures

  console.log(`🎞 Selected ${selected.length} movies for detailed scraping…`);

  const finalMovies = [];

  //
  // 📌 STEP 5 — Fetch Details + Credits (Parallel)
  //
  let index = 0;

  for (const m of selected) {
    index++;
    console.log(`⏳ ${index}/${selected.length} → ${m.title}`);

    const [details, credits] = await Promise.all([
      safeFetch(`${TMDB_BASE}/movie/${m.id}?api_key=${API_KEY}&language=en-US`),
      safeFetch(`${TMDB_BASE}/movie/${m.id}/credits?api_key=${API_KEY}&language=en-US`)
    ]);

    if (!details) {
      console.log(`⚠️ Skipping: details missing`);
      continue;
    }
    if (details.original_language !== "en" || /\d/.test(details.title)) {
      console.log(`🚫 Rejected after detail check: "${details.title}"`);
      continue;
    }

    // Extract cast/director safely
    const cast = (credits?.cast || [])
      .slice(0, 3)
      .map(c => c.name);

    const directorObj = (credits?.crew || []).find(c => c.job === "Director");

    finalMovies.push({
      id: m.id,
      title: details.title,
      year: details.release_date?.slice(0, 4) || "Unknown",
      genres: (details.genres || []).map(g => g.name),
      cast,
      director: directorObj ? directorObj.name : "",
      poster: details.poster_path
        ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
        : ""
    });

    if (finalMovies.length >= TARGET_COUNT) break;
  }

  //
  // 📌 STEP 6 — Save JSON
  //
  console.log(`📦 Saving ${finalMovies.length} movies → movies.json`);

  fs.writeFileSync(
    "movies.json",
    JSON.stringify(finalMovies, null, 2)
  );

  console.log("🎉 Done! Optimized movie list created.");
}

fetchMovies().catch(err => console.error("💀 Error:", err));
