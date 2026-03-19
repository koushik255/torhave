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
  /** @type {{ name: string, path: string } | null} */
  let selected = $state(null)
  let loading = $state(true)
  /** @type {string | null} */
  let error = $state(null)

  onMount(async () => {
    try {
      const r = await fetch('/api/movies')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      movies = await r.json()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load movies'
    } finally {
      loading = false
    }
  })

  /** @param {{ name: string, path: string }} m */
  function pick(m) {
    selected = m
  }
</script>

<h1>Movies</h1>

{#if error}
  <p class="error">{error}</p>
{:else}
  <div class="layout">
    <aside>
      <h2>Library</h2>
      {#if loading}
        <p class="muted">Loading…</p>
      {:else if movies.length === 0}
        <p class="muted">No videos found (mp4, mkv, webm).</p>
      {:else}
        <ul class="movie-list">
          {#each movies as m (m.path)}
            <li>
              <button
                type="button"
                class:active={selected?.path === m.path}
                onclick={() => pick(m)}
              >
                {m.name}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </aside>

    <main>
      {#if selected}
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
      {:else if !loading && movies.length > 0}
        <p class="placeholder">Choose a file to play.</p>
      {/if}
    </main>
  </div>
{/if}
