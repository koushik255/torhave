<script>
  import { onMount } from 'svelte'

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

  onMount(() => {
    function syncPath() {
      pathname = window.location.pathname
    }
    window.addEventListener('popstate', syncPath)

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

    return () => window.removeEventListener('popstate', syncPath)
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
      <video controls playsinline>
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
    <p class="muted">{selected.name}</p>
  {/if}
{:else}
  <p class="error">Not found.</p>
  <p class="muted"><a href="/">Go home</a></p>
{/if}
