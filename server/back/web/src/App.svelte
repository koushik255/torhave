<script>
  import { onMount } from 'svelte'
  import ClipRangeModal from './lib/ClipRangeModal.svelte'

  /** @param {string} rel */
  function encodePathSegments(rel) {
    return rel.split('/').map(encodeURIComponent).join('/')
  }

  /** @param {string} videoPath */
  function movieSrc(videoPath) {
    return `/movie/${encodePathSegments(videoPath)}`
  }

  /** @param {string} videoPath */
  function subtitleSrc(videoPath) {
    const srt = videoPath.replace(/\.[^.]+$/, '.srt')
    return `/subtitles/${encodePathSegments(srt)}`
  }

  /** @type {{ name: string, path: string }[]} */
  let movies = $state([])
  let loading = $state(true)
  /** @type {string | null} */
  let error = $state(null)

  let pathname = $state(
    typeof window !== 'undefined' ? window.location.pathname : '/',
  )

  const watchMatch = $derived(pathname.match(/^\/(\d+)$/))
  const watchNum = $derived(
    watchMatch ? parseInt(watchMatch[1], 10) : null,
  )
  const watchIndex = $derived(
    watchNum !== null && watchNum > 0 ? watchNum - 1 : null,
  )

  const isHome = $derived(pathname === '/' || pathname === '')
  const selected = $derived(
    watchIndex !== null && movies[watchIndex]
      ? movies[watchIndex]
      : null,
  )

  let clipStart = $state('')
  let clipEnd = $state('')
  let clipBusy = $state(false)
  /** @type {string | null} */
  let clipError = $state(null)

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n))
  }

  // Parse `seconds`, `MM:SS`, or `HH:MM:SS` (fractions allowed on last part).
  function parseTimeStr(s) {
    const t = s.trim()
    if (!t) return null
    if (!t.includes(':')) {
      const n = Number.parseFloat(t)
      return Number.isFinite(n) ? n : null
    }
    const p = t.split(':')
    if (p.length !== 2 && p.length !== 3) return null
    const nums = p.map((x) => Number.parseFloat(x))
    if (nums.some((n) => !Number.isFinite(n))) return null
    return p.length === 2
      ? nums[0] * 60 + nums[1]
      : nums[0] * 3600 + nums[1] * 60 + nums[2]
  }

  function formatSeconds(sec) {
    if (!Number.isFinite(sec)) return ''
    return sec.toFixed(2)
  }

  const clipMinGapSec = 0.05

  // Popup clip editor state.
  let clipEditorOpen = $state(false)
  let videoDurationSec = $state(0)
  let videoCurrentTimeSec = $state(0)
  let clipEditorStartSec = $state(0)
  let clipEditorEndSec = $state(0)

  /** @type {HTMLVideoElement | null} */
  let videoEl = $state(null)

  let clipEditorResumeOnClose = false

  /** @type {(() => void) | null} */
  let onVideoPlay = null

  function setClipEditorDragging(isDragging) {
    const v = videoEl
    if (!v) return

    if (isDragging) {
      // Modal editing is designed for a paused frame.
      if (!v.paused) v.pause()
      return
    }
  }

  /**
   * Seeks the video for live preview while the range editor is being dragged.
   * @param {number} timeSec
   */
  function seekPreview(timeSec) {
    const v = videoEl
    if (!v || !Number.isFinite(timeSec)) return
    const d = Number.isFinite(videoDurationSec) ? videoDurationSec : 0
    const t = clamp(timeSec, 0, d)
    v.currentTime = t
    videoCurrentTimeSec = t
  }

  /**
   * @param {number} startSec
   * @param {number} endSec
   */
  function syncClipRange(startSec, endSec) {
    const d = Number.isFinite(videoDurationSec) ? videoDurationSec : 0
    const start = clamp(startSec, 0, d)
    const minEnd = clamp(start + clipMinGapSec, 0, d)
    const end = clamp(endSec, minEnd, d)

    clipEditorStartSec = start
    clipEditorEndSec = end
    clipStart = formatSeconds(start)
    clipEnd = formatSeconds(end)
  }

  function openClipEditor() {
    const v = videoEl
    if (!v || v.readyState < 1) return

    clipEditorResumeOnClose = !v.paused
    v.pause()

    const d = Number.isFinite(v.duration) ? v.duration : 0
    videoDurationSec = d > 0 ? d : 0
    if (videoDurationSec <= 0) return

    const start = Number.isFinite(v.currentTime) ? v.currentTime : 0

    const parsedEnd = parseTimeStr(clipEnd)
    let end =
      parsedEnd === null ? Math.min(videoDurationSec, start + 1) : parsedEnd
    end = clamp(end, start + clipMinGapSec, videoDurationSec)

    syncClipRange(start, end)
    clipEditorOpen = true
    videoCurrentTimeSec = v.currentTime || 0

    onVideoPlay = () => {
      // Enforce paused frame editing.
      v.pause()
    }

    v.addEventListener('play', onVideoPlay)
  }

  function closeClipEditor() {
    clipEditorOpen = false
    const v = videoEl
    if (!v) return

    if (onVideoPlay) v.removeEventListener('play', onVideoPlay)
    onVideoPlay = null

    if (clipEditorResumeOnClose) v.play().catch(() => {})
  }

  /** @param {HTMLElement} el */
  function isTypingTarget(el) {
    if (el.closest('input, textarea, select, [contenteditable="true"]'))
      return true
    return el.isContentEditable
  }

  /** @param {string} movieName */
  function saveVideoScreenshot(movieName) {
    const v = videoEl
    if (!v || v.readyState < 2) return
    const w = v.videoWidth
    const h = v.videoHeight
    if (!w || !h) return
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v, 0, 0, w, h)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const stem = movieName
          .replace(/\.[^/.]+$/, '')
          .replace(/[^\w.-]+/g, '_')
          .slice(0, 80)
        const t = Math.floor(v.currentTime)
        const hh = String(Math.floor(t / 3600)).padStart(2, '0')
        const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0')
        const ss = String(t % 60).padStart(2, '0')
        a.href = url
        a.download = `${stem}_${hh}-${mm}-${ss}.png`
        a.click()
        URL.revokeObjectURL(url)
      },
      'image/png',
    )
  }

  /** @param {string} path */
  async function downloadClip(path) {
    clipError = null
    clipBusy = true
    try {
      const r = await fetch('/api/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: path,
          start: clipStart.trim(),
          end: clipEnd.trim(),
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${r.status}`)
      }
      const blob = await r.blob()
      const cd = r.headers.get('Content-Disposition')
      let name = 'clip.mp4'
      const m = cd && /filename="([^"]+)"/.exec(cd)
      if (m) name = m[1]
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      clipError = e instanceof Error ? e.message : 'Clip failed'
    } finally {
      clipBusy = false
    }
  }

  onMount(() => {
    function syncPath() {
      pathname = window.location.pathname
    }
    window.addEventListener('popstate', syncPath)

    /** @param {KeyboardEvent} e */
    function onKeydown(e) {
      if (e.key !== 's' && e.key !== 'S') return
      if (e.repeat) return
      if (e.target instanceof HTMLElement && isTypingTarget(e.target)) return
      const path = window.location.pathname
      const m = path.match(/^\/(\d+)$/)
      if (!m) return
      const idx = parseInt(m[1], 10) - 1
      if (idx < 0 || idx >= movies.length) return
      const movie = movies[idx]
      if (!movie) return
      const v = videoEl
      if (!v || v.readyState < 2) return
      e.preventDefault()
      saveVideoScreenshot(movie.name)
    }
    window.addEventListener('keydown', onKeydown)

    ;(async () => {
      try {
        const r = await fetch('/api/movies')
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        movies = await r.json()
      } catch (e) {
        error = e instanceof Error ? e.message : 'Failed to load movies'
      } finally {
        loading = false
      }
    })()

    return () => {
      window.removeEventListener('popstate', syncPath)
      window.removeEventListener('keydown', onKeydown)
    }
  })
</script>

{#if error}
  <p class="error">{error}</p>
{:else if loading}
  <p class="muted">Loading…</p>
{:else if isHome}
  <h1>Movies</h1>
  {#if movies.length === 0}
    <p class="muted">No videos found (mp4, mkv, webm).</p>
  {:else}
    <ul class="title-list">
      {#each movies as m, i (m.path)}
        <li>
          <a href="/{i + 1}">{m.name}</a>
        </li>
      {/each}
    </ul>
  {/if}
{:else if watchMatch}
  <nav class="back">
    <a href="/">← Movies</a>
  </nav>
  {#if watchIndex === null || watchNum === 0}
    <p class="error">Invalid address (use /1, /2, …).</p>
  {:else if !selected}
    <p class="error">No movie at this index.</p>
  {:else}
    {#key selected.path}
      <video
        bind:this={videoEl}
        class="watch-video"
        controls
        playsinline
        onloadedmetadata={() => {
          if (!videoEl) return
          const d = Number.isFinite(videoEl.duration) ? videoEl.duration : 0
          videoDurationSec = d > 0 ? d : 0
        }}
        ontimeupdate={() => {
          if (!clipEditorOpen) return
          if (!videoEl) return
          videoCurrentTimeSec = videoEl.currentTime || 0
        }}
      >
        <source src={movieSrc(selected.path)} />
        <track
          kind="subtitles"
          srclang="en"
          label="Subtitles"
          src={subtitleSrc(selected.path)}
          default
        />
      </video>
    {/key}
    <div class="clip-row">
      <p class="muted">{selected.name}</p>
      <div class="clip-form">
        <label>
          Start
          <input type="text" bind:value={clipStart} placeholder="e.g. 120 or 2:00" />
        </label>
        <label>
          End
          <input type="text" bind:value={clipEnd} placeholder="e.g. 180 or 3:00" />
        </label>
        <button
          type="button"
          class="clip-btn clip-edit-btn"
          disabled={clipBusy || clipEditorOpen || videoDurationSec <= 0}
          onclick={() => openClipEditor()}
        >
          Edit range
        </button>
        <button
          type="button"
          class="clip-btn"
          disabled={clipBusy}
          onclick={() => downloadClip(selected.path)}
        >
          {clipBusy ? 'Working…' : 'Download clip'}
        </button>
      </div>
      {#if clipError}
        <p class="error clip-err">{clipError}</p>
      {/if}
    </div>
    {#if clipEditorOpen}
      <ClipRangeModal
        durationSec={videoDurationSec}
        startSec={clipEditorStartSec}
        endSec={clipEditorEndSec}
        currentTimeSec={videoCurrentTimeSec}
        startLocked={true}
        onChange={(s, e) => syncClipRange(s, e)}
        onClose={closeClipEditor}
        onPreview={seekPreview}
        onDragStateChange={setClipEditorDragging}
      />
    {/if}
    <p class="muted hint-s">Press <kbd>S</kbd> to save a screenshot of the current frame.</p>
  {/if}
{:else}
  <p class="error">Not found.</p>
  <p class="muted"><a href="/">Go home</a></p>
{/if}
