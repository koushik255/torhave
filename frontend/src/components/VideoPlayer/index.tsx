import { useCallback, useEffect, useRef, useState } from 'react';
import { MovieList } from './MovieList';
import { PlayerControls } from './PlayerControls';
import type { VolumeIconLevel } from './types';

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const formatSeconds = (seconds: number) => {
  if (isNaN(seconds)) return "00:00";
  const showMilliseconds = window.innerWidth >= 640;
  const roundedSeconds = Math.round(seconds * 1000) / 1000;
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainingSeconds = Math.floor(roundedSeconds % 60);
  const milliseconds = Math.floor((roundedSeconds * 1000) % 1000)
    .toString()
    .padStart(3, '0');

  let result = hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    : `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;

  if (showMilliseconds) {
    result += `.${milliseconds}`;
  }

  return result;
};

export const VideoPlayer = () => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarContainerRef = useRef<HTMLDivElement>(null);
  const volumeBarContainerRef = useRef<HTMLDivElement>(null);

  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [playerVisible, setPlayerVisible] = useState(false);
  const [showVolumeControls] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTimeText, setCurrentTimeText] = useState(formatSeconds(0));
  const [durationText, setDurationText] = useState(formatSeconds(0));
  const [progressPercent, setProgressPercent] = useState(0);
  const [volumePercent, setVolumePercent] = useState(70);
  const [volumeIconLevel, setVolumeIconLevel] = useState<VolumeIconLevel>(3);
  const [unstyledMode, setUnstyledMode] = useState(false);

  const draggingProgressBarRef = useRef(false);
  const draggingVolumeBarRef = useRef(false);
  const hideControlsTimeoutRef = useRef<number | null>(null);

  const clearHideControlsTimeout = useCallback(() => {
    if (hideControlsTimeoutRef.current !== null) {
      window.clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = null;
    }
  }, []);

  const updateProgressBarUI = useCallback((seconds: number, duration: number) => {
    const safeSeconds = clamp(seconds, 0, duration || 0);
    setCurrentTimeText(formatSeconds(safeSeconds));
    setProgressPercent(duration > 0 ? (safeSeconds / duration) * 100 : 0);
  }, []);

  const hideControls = useCallback(() => {
    setControlsVisible(false);
    setCursorHidden(true);
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    setCursorHidden(false);
    clearHideControlsTimeout();

    hideControlsTimeoutRef.current = window.setTimeout(() => {
      if (draggingProgressBarRef.current) return;
      hideControls();
    }, 2000);
  }, [clearHideControlsTimeout, hideControls]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(console.error);
    } else {
      videoRef.current.pause();
    }
  }, []);

  const seekToTime = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
  }, []);

  const initMediaPlayer = useCallback((url: string) => {
    setLoading(true);
    setPlayerVisible(true);
    setErrorMessage('');
    setControlsVisible(false);
    setCursorHidden(false);
    setPlaying(false);
    setCurrentTimeText(formatSeconds(0));
    setDurationText(formatSeconds(0));
    setProgressPercent(0);

    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.load();
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    const handleTimeUpdate = () => {
      if (!draggingProgressBarRef.current) {
        updateProgressBarUI(video.currentTime, video.duration);
      }
    };
    const handleDurationChange = () => {
      setDurationText(formatSeconds(video.duration));
    };
    const handleWaiting = () => setLoading(true);
    const handleCanPlay = () => setLoading(false);
    const handleError = () => {
      setErrorMessage('Failed to load video');
      setLoading(false);
    };
    const handleVolumeChange = () => {
      const volume = video.muted ? 0 : video.volume;
      setVolumePercent(volume * 100);
      const level = video.muted ? 0 : Math.ceil(1 + 3 * video.volume);
      setVolumeIconLevel(level as VolumeIconLevel);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('volumechange', handleVolumeChange);

    // Set initial volume
    video.volume = 0.7;

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [updateProgressBarUI]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!videoRef.current) return;

      if (event.code === 'Space' || event.code === 'KeyK') {
        togglePlay();
      } else if (event.code === 'KeyF') {
        playerContainerRef.current?.requestFullscreen().catch(console.error);
      } else if (event.code === 'ArrowLeft') {
        seekToTime(Math.max(videoRef.current.currentTime - 5, 0));
      } else if (event.code === 'ArrowRight') {
        seekToTime(Math.min(videoRef.current.currentTime + 5, videoRef.current.duration));
      } else if (event.code === 'KeyM') {
        videoRef.current.muted = !videoRef.current.muted;
      } else {
        return;
      }

      showControlsTemporarily();
      event.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [seekToTime, showControlsTemporarily, togglePlay]);

  const handleSelectMovie = (url: string, name: string) => {
    setFileName(name);
    initMediaPlayer(url);
  };

  const handleToggleUnstyledMode = () => {
    setUnstyledMode((v) => !v);
  };

  const handleProgressPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarContainerRef.current || !videoRef.current || videoRef.current.duration <= 0) return;

    const target = event.currentTarget;
    const pointerId = event.pointerId;
    draggingProgressBarRef.current = true;
    target.setPointerCapture(pointerId);

    const updateFromPointer = (e: PointerEvent | React.PointerEvent) => {
      const rect = progressBarContainerRef.current!.getBoundingClientRect();
      const completion = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      updateProgressBarUI(completion * videoRef.current!.duration, videoRef.current!.duration);
      return completion;
    };

    updateFromPointer(event);
    clearHideControlsTimeout();

    const handlePointerUp = (upEvent: PointerEvent) => {
      draggingProgressBarRef.current = false;
      target.releasePointerCapture(pointerId);
      const completion = updateFromPointer(upEvent);
      seekToTime(completion * videoRef.current!.duration);
      showControlsTemporarily();
    };

    window.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  const handleProgressPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingProgressBarRef.current || !progressBarContainerRef.current || !videoRef.current) return;
    const rect = progressBarContainerRef.current.getBoundingClientRect();
    const completion = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    updateProgressBarUI(completion * videoRef.current.duration, videoRef.current.duration);
  };

  const handleVolumePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!volumeBarContainerRef.current || !videoRef.current) return;

    const target = event.currentTarget;
    const pointerId = event.pointerId;
    draggingVolumeBarRef.current = true;
    target.setPointerCapture(pointerId);

    const updateFromPointer = (e: PointerEvent | React.PointerEvent) => {
      const rect = volumeBarContainerRef.current!.getBoundingClientRect();
      const vol = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      videoRef.current!.volume = vol;
      videoRef.current!.muted = false;
    };

    updateFromPointer(event);
    clearHideControlsTimeout();

    const handlePointerUp = (upEvent: PointerEvent) => {
      draggingVolumeBarRef.current = false;
      target.releasePointerCapture(pointerId);
      updateFromPointer(upEvent);
      showControlsTemporarily();
    };

    window.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  const handleVolumePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingVolumeBarRef.current || !volumeBarContainerRef.current || !videoRef.current) return;
    const rect = volumeBarContainerRef.current.getBoundingClientRect();
    const vol = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    videoRef.current.volume = vol;
  };

  const handleVolumeButtonClick = () => {
    if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
  };

  const handleFullscreenClick = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    } else {
      playerContainerRef.current?.requestFullscreen().catch(console.error);
    }
  };

  return (
    <section className={`player-example${unstyledMode ? ' player-example--unstyled' : ''}`}>
      <MovieList
        onSelectMovie={handleSelectMovie}
        unstyledMode={unstyledMode}
        onToggleUnstyledMode={handleToggleUnstyledMode}
      />

      <p className="player-example__file-name">{fileName}</p>

      {fileName && <hr className="player-example__divider" />}

      {errorMessage && (
        <p className="player-example__message player-example__message--error">{errorMessage}</p>
      )}
      {loading && (
        <p className="player-example__message player-example__message--loading">Loading...</p>
      )}

      {playerVisible && (
        <div
          ref={playerContainerRef}
          className="player-shell"
          style={{ cursor: cursorHidden ? 'none' : 'default' }}
          onPointerMove={(e) => { if (e.pointerType !== 'touch') showControlsTemporarily(); }}
          onPointerLeave={(e) => {
            if (draggingProgressBarRef.current || draggingVolumeBarRef.current || e.pointerType === 'touch') return;
            hideControls();
            clearHideControlsTimeout();
          }}
          onClick={() => {
            const isTouch = 'ontouchstart' in window;
            if (isTouch) controlsVisible ? hideControls() : showControlsTemporarily();
            else togglePlay();
          }}
        >
          <video
            ref={videoRef}
            className="player-canvas"
            width={1280}
            height={720}
            playsInline
          />

          <PlayerControls
            controlsVisible={controlsVisible}
            playing={playing}
            showVolumeControls={showVolumeControls}
            currentTimeText={currentTimeText}
            durationText={durationText}
            progressPercent={progressPercent}
            volumePercent={volumePercent}
            volumeIconLevel={volumeIconLevel}
            progressBarContainerRef={progressBarContainerRef}
            volumeBarContainerRef={volumeBarContainerRef}
            showControlsTemporarily={showControlsTemporarily}
            togglePlay={togglePlay}
            handleVolumeButtonClick={handleVolumeButtonClick}
            handleProgressPointerDown={handleProgressPointerDown}
            handleProgressPointerMove={handleProgressPointerMove}
            handleVolumePointerDown={handleVolumePointerDown}
            handleVolumePointerMove={handleVolumePointerMove}
            handleFullscreenClick={handleFullscreenClick}
          />
        </div>
      )}
    </section>
  );
};

export default VideoPlayer;
