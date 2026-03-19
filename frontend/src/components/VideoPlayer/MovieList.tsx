import { useEffect, useState } from 'react';

type Movie = {
  path: string;
  name: string;
  hasSubtitles: boolean;
  subtitlePath: string | null;
};

type MovieListProps = {
  onSelectMovie: (url: string, name: string) => void;
  unstyledMode: boolean;
  onToggleUnstyledMode: () => void;
};

export const MovieList = ({
  onSelectMovie,
  unstyledMode,
  onToggleUnstyledMode,
}: MovieListProps) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/movies')
      .then((res) => res.json())
      .then((data) => {
        setMovies(data);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to load movies');
        setLoading(false);
        console.error(err);
      });
  }, []);

  if (loading) {
    return <p className="player-example__message player-example__message--loading">Loading movies...</p>;
  }

  if (error) {
    return <p className="player-example__message player-example__message--error">{error}</p>;
  }

  return (
    <>
      <div className="player-example__actions">
        <div className="player-example__buttons">
          <button
            type="button"
            className="player-example__button"
            onClick={onToggleUnstyledMode}
          >
            {unstyledMode ? 'Use CSS' : 'No CSS'}
          </button>
        </div>
      </div>

      <div className="movie-list">
        {movies.length === 0 ? (
          <p className="player-example__message">No movies found</p>
        ) : (
          movies.map((movie) => (
            <button
              key={movie.path}
              type="button"
              className="movie-list__item player-example__button"
              onClick={() => onSelectMovie(`/api/stream?path=${encodeURIComponent(movie.path)}`, movie.name)}
            >
              {movie.name}
              {movie.hasSubtitles && ' [CC]'}
            </button>
          ))
        )}
      </div>
    </>
  );
};
