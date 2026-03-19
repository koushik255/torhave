const movieList = document.getElementById('movie-list') as HTMLDivElement;
const videoPlayer = document.getElementById('video-player') as HTMLVideoElement;
const placeholder = document.getElementById('placeholder') as HTMLDivElement;
const screenshotBtn = document.getElementById('screenshot-btn') as HTMLButtonElement;
const screenshotDialog = document.getElementById('screenshot-dialog') as HTMLDialogElement;
const screenshotCanvas = document.getElementById('screenshot-canvas') as HTMLCanvasElement;
const screenshotImg = document.getElementById('screenshot-img') as HTMLImageElement;
const saveScreenshotBtn = document.getElementById('save-screenshot') as HTMLButtonElement;
const closeDialogBtn = document.getElementById('close-dialog') as HTMLButtonElement;

interface Movie {
  name: string;
  path: string;
}

let currentMovieName = '';

async function loadMovies() {
  try {
    const res = await fetch('/api/movies');
    const movies: Movie[] = await res.json();
    renderMovies(movies);
  } catch (err) {
    movieList.textContent = 'Failed to load movies';
  }
}

function renderMovies(movies: Movie[]) {
  if (movies.length === 0) {
    movieList.textContent = 'No movies found';
    return;
  }
  movieList.innerHTML = movies.map((movie) => `
    <div class="movie-item p-3 cursor-pointer rounded hover:bg-[#2a2a2a] transition-colors mb-1" data-path="${encodeURIComponent(movie.path)}" data-name="${movie.name.replace(/"/g, '&quot;')}">
      ${movie.name}
    </div>
  `).join('');

  movieList.querySelectorAll('.movie-item').forEach(item => {
    item.addEventListener('click', () => playMovie(item as HTMLElement));
  });
}

function playMovie(item: HTMLElement) {
  document.querySelectorAll('.movie-item').forEach(el => el.classList.remove('bg-[#333]'));
  item.classList.add('bg-[#333]');

  const path = item.dataset.path!;
  currentMovieName = item.dataset.name || 'movie';
  const decodedPath = decodeURIComponent(path);
  const subtitlePath = decodedPath.replace(/\.(mp4|mkv|webm)$/i, '.srt');
  const subtitleUrl = `/subtitles/${encodeURIComponent(subtitlePath)}`;

  console.log('Video path:', decodedPath);
  console.log('Subtitle URL:', subtitleUrl);

  videoPlayer.src = `/movie/${path}`;

  const existingTrack = videoPlayer.querySelector('track');
  if (existingTrack) existingTrack.remove();

  fetch(subtitleUrl)
    .then(res => {
      if (!res.ok) {
        console.log('no subtitles found');
        return;
      }
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.src = subtitleUrl;
      track.srclang = 'en';
      track.label = 'English';
      track.default = true;
      videoPlayer.appendChild(track);
    })
    .catch(() => console.log('no subtitles found'));

  videoPlayer.classList.remove('hidden');
  screenshotBtn.classList.remove('hidden');
  placeholder.classList.add('hidden');
  videoPlayer.play();
}

function captureScreenshot() {
  if (videoPlayer.videoWidth === 0 || videoPlayer.videoHeight === 0) {
    console.log('Video not loaded');
    return;
  }
  
  const ctx = screenshotCanvas.getContext('2d')!;
  screenshotCanvas.width = videoPlayer.videoWidth;
  screenshotCanvas.height = videoPlayer.videoHeight;
  ctx.drawImage(videoPlayer, 0, 0);
  
  const dataUrl = screenshotCanvas.toDataURL('image/png');
  screenshotImg.src = dataUrl;
  screenshotDialog.showModal();
}

function saveScreenshot() {
  const timestamp = formatTimestamp(videoPlayer.currentTime);
  const sanitizedName = currentMovieName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${sanitizedName}-${timestamp}.png`;
  
  const link = document.createElement('a');
  link.download = filename;
  link.href = screenshotImg.src;
  link.click();
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}-${m}-${s}`;
}

screenshotBtn.addEventListener('click', captureScreenshot);
saveScreenshotBtn.addEventListener('click', saveScreenshot);
closeDialogBtn.addEventListener('click', () => screenshotDialog.close());
screenshotDialog.addEventListener('click', (e) => {
  if (e.target === screenshotDialog) {
    screenshotDialog.close();
  }
});

loadMovies();
