import { useState, useEffect } from 'react'

interface Movie {
  name: string;
  path: string;
}

const API_BASE = ''; // Use relative paths for proxying

function App() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<string>('');

  useEffect(() => {
    fetch(`${API_BASE}/api/movies`)
      .then(res => res.json())
      .then(data => {
        setMovies(data);
        if (data.length > 0) setSelectedMovie(data[0].path);
      })
      .catch(err => console.error("Error fetching movies:", err));
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Movie Server</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="movie-select">Select Movie: </label>
        <select 
          id="movie-select"
          value={selectedMovie} 
          onChange={(e) => setSelectedMovie(e.target.value)}
          style={{ padding: '5px', width: '100%' }}
        >
          {movies.map(movie => (
            <option key={movie.path} value={movie.path}>
              {movie.name}
            </option>
          ))}
        </select>
      </div>

      {selectedMovie && (
        <div key={selectedMovie}>
          <video 
            controls 
            autoPlay
            style={{ width: '100%', maxHeight: '500px', background: '#000' }}
          >
            <source src={`${API_BASE}/movies/${encodeURIComponent(selectedMovie)}`} />
            Your browser does not support the video tag.
          </video>
        </div>
      )}
    </div>
  )
}

export default App
