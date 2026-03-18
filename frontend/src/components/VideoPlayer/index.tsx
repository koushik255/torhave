import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ALL_FORMATS,
  AudioBufferSink,
  CanvasSink,
  Input,
  UrlSource,
  type WrappedAudioBuffer,
  type WrappedCanvas,
} from 'mediabunny';
import { buildInspectData } from '../../features/inspect/inspect';
import { InspectModal } from '../../features/inspect/InspectModal';
import { MovieList } from './MovieList';
import { PlayerControls } from './PlayerControls';
import type { InspectData, VolumeIconLevel } from './types';

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const formatSeconds = (seconds: number) => {
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const progressBarContainerRef = useRef<HTMLDivElement>(null);
  const volumeBarContainerRef = useRef<HTMLDivElement>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const fileLoadedRef = useRef(false);
  const videoSinkRef = useRef<CanvasSink | null>(null);
  const audioSinkRef = useRef<AudioBufferSink | null>(null);
  const totalDurationRef = useRef(0);
  const audioContextStartTimeRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  const playbackTimeAtStartRef = useRef(0);
  const videoFrameIteratorRef = useRef<AsyncGenerator<WrappedCanvas, void, unknown> | null>(null);
  const audioBufferIteratorRef = useRef<AsyncGenerator<WrappedAudioBuffer, void, unknown> | null>(null);
  const nextFrameRef = useRef<WrappedCanvas | null>(null);
  const queuedAudioNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const asyncIdRef = useRef(0);
  const draggingProgressBarRef = useRef(false);
  const draggingVolumeBarRef = useRef(false);
  const volumeRef = useRef(0.7);
  const volumeMutedRef = useRef(false);
  const hideControlsTimeoutRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hasVideoRef = useRef(false);
  const inspectRequestIdRef = useRef(0);

  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [playerVisible, setPlayerVisible] = useState(false);
  const [showCanvas, setShowCanvas] = useState(true);
  const [showVolumeControls, setShowVolumeControls] = useState(true);
  const [playerTransparent, setPlayerTransparent] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTimeText, setCurrentTimeText] = useState(formatSeconds(0));
  const [durationText, setDurationText] = useState(formatSeconds(0));
  const [progressPercent, setProgressPercent] = useState(0);
  const [volumePercent, setVolumePercent] = useState(volumeRef.current * 100);
  const [volumeIconLevel, setVolumeIconLevel] = useState<VolumeIconLevel>(4);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectData, setInspectData] = useState<InspectData | null>(null);
  const [unstyledMode, setUnstyledMode] = useState(false);

  const clearHideControlsTimeout = useCallback(() => {
    if (hideControlsTimeoutRef.current !== null) {
      window.clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = null;
    }
  }, []);

  const updateProgressBarTime = useCallback((seconds: number) => {
    const duration = totalDurationRef.current;
    const safeSeconds = clamp(seconds, 0, duration || 0);
    setCurrentTimeText(formatSeconds(safeSeconds));
    setProgressPercent(duration > 0 ? (safeSeconds / duration) * 100 : 0);
  }, []);

  const updateVolume = useCallback(() => {
    const actualVolume = volumeMutedRef.current ? 0 : volumeRef.current;
    setVolumePercent(actualVolume * 100);

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = actualVolume ** 2;
    }

    const iconNumber = volumeMutedRef.current ? 0 : Math.ceil(1 + 3 * volumeRef.current);
    setVolumeIconLevel(iconNumber as VolumeIconLevel);
  }, []);

  const getPlaybackTime = useCallback(() => {
    if (playingRef.current && audioContextRef.current && audioContextStartTimeRef.current !== null) {
      return audioContextRef.current.currentTime
        - audioContextStartTimeRef.current
        + playbackTimeAtStartRef.current;
    }

    return playbackTimeAtStartRef.current;
  }, []);

  const hideControls = useCallback(() => {
    if (!hasVideoRef.current) {
      return;
    }

    setControlsVisible(false);
    setCursorHidden(true);
  }, []);

  const showControlsTemporarily = useCallback(() => {
    if (!hasVideoRef.current) {
      return;
    }

    setControlsVisible(true);
    setCursorHidden(false);
    clearHideControlsTimeout();

    hideControlsTimeoutRef.current = window.setTimeout(() => {
      if (draggingProgressBarRef.current) {
        return;
      }

      hideControls();
    }, 2000);
  }, [clearHideControlsTimeout, hideControls]);

  const pause = useCallback(() => {
    playbackTimeAtStartRef.current = getPlaybackTime();
    playingRef.current = false;
    setPlaying(false);

    void audioBufferIteratorRef.current?.return?.();
    audioBufferIteratorRef.current = null;

    for (const node of queuedAudioNodesRef.current) {
      node.stop();
    }

    queuedAudioNodesRef.current.clear();
  }, [getPlaybackTime]);

  const startVideoIterator = useCallback(async () => {
    if (!videoSinkRef.current || !contextRef.current || !canvasRef.current) {
      return;
    }

    asyncIdRef.current += 1;
    await videoFrameIteratorRef.current?.return?.();

    videoFrameIteratorRef.current = videoSinkRef.current.canvases(getPlaybackTime());

    const firstFrame = (await videoFrameIteratorRef.current.next()).value ?? null;
    const secondFrame = (await videoFrameIteratorRef.current.next()).value ?? null;

    nextFrameRef.current = secondFrame;

    if (firstFrame) {
      contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      contextRef.current.drawImage(firstFrame.canvas, 0, 0);
    }
  }, [getPlaybackTime]);

  const updateNextFrame = useCallback(async () => {
    const currentAsyncId = asyncIdRef.current;

    while (videoFrameIteratorRef.current && contextRef.current && canvasRef.current) {
      const newNextFrame = (await videoFrameIteratorRef.current.next()).value ?? null;

      if (!newNextFrame || currentAsyncId !== asyncIdRef.current) {
        break;
      }

      const playbackTime = getPlaybackTime();
      if (newNextFrame.timestamp <= playbackTime) {
        contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        contextRef.current.drawImage(newNextFrame.canvas, 0, 0);
      } else {
        nextFrameRef.current = newNextFrame;
        break;
      }
    }
  }, [getPlaybackTime]);

  const runAudioIterator = useCallback(async () => {
    if (!audioSinkRef.current || !audioContextRef.current || !gainNodeRef.current || !audioBufferIteratorRef.current) {
      return;
    }

    for await (const { buffer, timestamp } of audioBufferIteratorRef.current) {
      if (!audioContextRef.current || !gainNodeRef.current || audioContextStartTimeRef.current === null) {
        break;
      }

      const node = audioContextRef.current.createBufferSource();
      node.buffer = buffer;
      node.connect(gainNodeRef.current);

      const startTimestamp = audioContextStartTimeRef.current + timestamp - playbackTimeAtStartRef.current;

      if (startTimestamp >= audioContextRef.current.currentTime) {
        node.start(startTimestamp);
      } else {
        node.start(audioContextRef.current.currentTime, audioContextRef.current.currentTime - startTimestamp);
      }

      queuedAudioNodesRef.current.add(node);
      node.onended = () => {
        queuedAudioNodesRef.current.delete(node);
      };

      if (timestamp - getPlaybackTime() >= 1) {
        await new Promise<void>((resolve) => {
          const waitId = window.setInterval(() => {
            if (timestamp - getPlaybackTime() < 1) {
              window.clearInterval(waitId);
              resolve();
            }
          }, 100);
        });
      }
    }
  }, [getPlaybackTime]);

  const play = useCallback(async () => {
    if (!audioContextRef.current) {
      return;
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (getPlaybackTime() === totalDurationRef.current) {
      playbackTimeAtStartRef.current = 0;
      await startVideoIterator();
    }

    audioContextStartTimeRef.current = audioContextRef.current.currentTime;
    playingRef.current = true;
    setPlaying(true);

    if (audioSinkRef.current) {
      void audioBufferIteratorRef.current?.return?.();
      audioBufferIteratorRef.current = audioSinkRef.current.buffers(getPlaybackTime());
      void runAudioIterator();
    }
  }, [getPlaybackTime, runAudioIterator, startVideoIterator]);

  const togglePlay = useCallback(() => {
    if (!fileLoadedRef.current) {
      return;
    }

    if (playingRef.current) {
      pause();
    } else {
      void play();
    }
  }, [pause, play]);

  const seekToTime = useCallback(async (seconds: number) => {
    updateProgressBarTime(seconds);

    const wasPlaying = playingRef.current;
    if (wasPlaying) {
      pause();
    }

    playbackTimeAtStartRef.current = seconds;
    await startVideoIterator();

    if (wasPlaying && playbackTimeAtStartRef.current < totalDurationRef.current) {
      void play();
    }
  }, [pause, play, startVideoIterator, updateProgressBarTime]);

  const disposePlayback = useCallback(async () => {
    clearHideControlsTimeout();

    if (playingRef.current) {
      pause();
    }

    void videoFrameIteratorRef.current?.return?.();
    void audioBufferIteratorRef.current?.return?.();

    videoFrameIteratorRef.current = null;
    audioBufferIteratorRef.current = null;
    nextFrameRef.current = null;
    videoSinkRef.current = null;
    audioSinkRef.current = null;
    fileLoadedRef.current = false;
    hasVideoRef.current = false;
    asyncIdRef.current += 1;
    inspectRequestIdRef.current += 1;

    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    gainNodeRef.current = null;
  }, [clearHideControlsTimeout, pause]);

  const initMediaPlayer = useCallback(async (url: string) => {
    try {
      await disposePlayback();

      setLoading(true);
      setPlayerVisible(true);
      setErrorMessage('');
      setWarningMessage('');
      setControlsVisible(false);
      setCursorHidden(false);
      setInspectOpen(false);
      setInspectData(null);
      updateProgressBarTime(0);
      playbackTimeAtStartRef.current = 0;
      totalDurationRef.current = 0;

      const source = new UrlSource(url);
      const input = new Input({
        source,
        formats: ALL_FORMATS,
      });

      totalDurationRef.current = await input.computeDuration();
      setDurationText(formatSeconds(totalDurationRef.current));

      const inspectRequestId = inspectRequestIdRef.current + 1;
      inspectRequestIdRef.current = inspectRequestId;
      void buildInspectData(input, url, totalDurationRef.current)
        .then((data) => {
          if (inspectRequestIdRef.current === inspectRequestId) {
            setInspectData(data);
          }
        })
        .catch((inspectError) => {
          console.error('Failed to inspect media:', inspectError);
        });

      let videoTrack = await input.getPrimaryVideoTrack();
      let audioTrack = await input.getPrimaryAudioTrack();

      console.log('Video track:', videoTrack ? { codec: videoTrack.codec, width: videoTrack.displayWidth, height: videoTrack.displayHeight } : null);
      console.log('Audio track:', audioTrack ? { codec: audioTrack.codec, sampleRate: audioTrack.sampleRate } : null);

      let problemMessage = '';

      if (videoTrack) {
        if (videoTrack.codec === null) {
          problemMessage += 'Unsupported video codec. ';
          videoTrack = null;
        } else if (!(await videoTrack.canDecode())) {
          problemMessage += `Unable to decode the video track (codec: ${videoTrack.codec}). `;
          videoTrack = null;
        }
      }

      if (audioTrack) {
        if (audioTrack.codec === null) {
          problemMessage += 'Unsupported audio codec. ';
          audioTrack = null;
        } else if (!(await audioTrack.canDecode())) {
          problemMessage += `Unable to decode the audio track (codec: ${audioTrack.codec}). `;
          audioTrack = null;
        }
      }

      if (!videoTrack && !audioTrack) {
        throw new Error(problemMessage || 'No audio or video track found.');
      }

      setWarningMessage(problemMessage.trim());

      const AudioContextCtor =
        window.AudioContext
        || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextCtor) {
        throw new Error('Web Audio is not supported in this browser.');
      }

      audioContextRef.current = new AudioContextCtor({
        sampleRate: audioTrack?.sampleRate,
      });

      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
      updateVolume();

      const videoCanBeTransparent = videoTrack
        ? await videoTrack.canBeTransparent()
        : false;

      setPlayerTransparent(videoCanBeTransparent);

      videoSinkRef.current = videoTrack
        ? new CanvasSink(videoTrack, {
            poolSize: 2,
            fit: 'contain',
            alpha: videoCanBeTransparent,
          })
        : null;

      audioSinkRef.current = audioTrack
        ? new AudioBufferSink(audioTrack)
        : null;

      hasVideoRef.current = Boolean(videoTrack);
      setShowCanvas(Boolean(videoTrack));
      setShowVolumeControls(Boolean(audioTrack));

      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          contextRef.current = canvasRef.current?.getContext('2d') ?? null;
          resolve();
        });
      });

      if (videoTrack && canvasRef.current) {
        canvasRef.current.width = videoTrack.displayWidth;
        canvasRef.current.height = videoTrack.displayHeight;
      }

      fileLoadedRef.current = true;
      await startVideoIterator();

      if (audioContextRef.current.state === 'running') {
        await play();
      }

      setLoading(false);
      setPlayerVisible(true);

      if (!videoSinkRef.current) {
        setControlsVisible(true);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(String(error));
      setLoading(false);
      setPlayerVisible(false);
      setInspectData(null);
    }
  }, [disposePlayback, play, startVideoIterator, updateProgressBarTime, updateVolume]);

  useEffect(() => {
    contextRef.current = canvasRef.current?.getContext('2d') ?? null;
    updateVolume();
  }, [playerVisible, updateVolume]);

  useEffect(() => {
    const render = () => {
      if (fileLoadedRef.current && canvasRef.current && contextRef.current) {
        const playbackTime = getPlaybackTime();

        if (playbackTime >= totalDurationRef.current) {
          pause();
          playbackTimeAtStartRef.current = totalDurationRef.current;
          updateProgressBarTime(totalDurationRef.current);
        }

        if (nextFrameRef.current && nextFrameRef.current.timestamp <= playbackTime) {
          contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          contextRef.current.drawImage(nextFrameRef.current.canvas, 0, 0);
          nextFrameRef.current = null;
          void updateNextFrame();
        }

        if (!draggingProgressBarRef.current) {
          updateProgressBarTime(playbackTime);
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(() => render());
    };

    render();

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [getPlaybackTime, pause, updateNextFrame, updateProgressBarTime]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape' && inspectOpen) {
        setInspectOpen(false);
        event.preventDefault();
        return;
      }

      if (!fileLoadedRef.current) {
        return;
      }

      if (event.code === 'Space' || event.code === 'KeyK') {
        togglePlay();
      } else if (event.code === 'KeyF') {
        playerContainerRef.current?.requestFullscreen().catch((fullscreenError) => {
          console.error('Failed to enter fullscreen mode:', fullscreenError);
        });
      } else if (event.code === 'ArrowLeft') {
        void seekToTime(Math.max(getPlaybackTime() - 5, 0));
      } else if (event.code === 'ArrowRight') {
        void seekToTime(Math.min(getPlaybackTime() + 5, totalDurationRef.current));
      } else if (event.code === 'KeyM') {
        volumeMutedRef.current = !volumeMutedRef.current;
        updateVolume();
      } else {
        return;
      }

      showControlsTemporarily();
      event.preventDefault();
    };

    const handleResize = () => {
      if (totalDurationRef.current) {
        updateProgressBarTime(getPlaybackTime());
        setDurationText(formatSeconds(totalDurationRef.current));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [getPlaybackTime, inspectOpen, seekToTime, showControlsTemporarily, togglePlay, updateProgressBarTime, updateVolume]);

  useEffect(() => {
    return () => {
      void disposePlayback();
    };
  }, [disposePlayback]);

  const handleSelectMovie = (url: string, name: string) => {
    setFileName(name);
    void initMediaPlayer(url);
  };

  const handleOpenInspect = () => {
    if (inspectData) {
      setInspectOpen(true);
    }
  };

  const handleToggleUnstyledMode = () => {
    setUnstyledMode((currentValue) => !currentValue);
  };

  const handleProgressPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarContainerRef.current || totalDurationRef.current <= 0) {
      return;
    }

    const target = event.currentTarget;
    const pointerId = event.pointerId;

    draggingProgressBarRef.current = true;
    target.setPointerCapture(pointerId);

    const rect = progressBarContainerRef.current.getBoundingClientRect();
    const completion = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    updateProgressBarTime(completion * totalDurationRef.current);
    clearHideControlsTimeout();

    const handlePointerUp = (upEvent: PointerEvent) => {
      draggingProgressBarRef.current = false;
      if (target.hasPointerCapture(pointerId)) {
        target.releasePointerCapture(pointerId);
      }

      const nextRect = progressBarContainerRef.current?.getBoundingClientRect();
      if (!nextRect) {
        return;
      }

      const nextCompletion = clamp((upEvent.clientX - nextRect.left) / nextRect.width, 0, 1);
      void seekToTime(nextCompletion * totalDurationRef.current);
      showControlsTemporarily();
    };

    window.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  const handleProgressPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingProgressBarRef.current || !progressBarContainerRef.current) {
      return;
    }

    const rect = progressBarContainerRef.current.getBoundingClientRect();
    const completion = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    updateProgressBarTime(completion * totalDurationRef.current);
  };

  const handleVolumePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!volumeBarContainerRef.current) {
      return;
    }

    const target = event.currentTarget;
    const pointerId = event.pointerId;

    draggingVolumeBarRef.current = true;
    target.setPointerCapture(pointerId);

    const rect = volumeBarContainerRef.current.getBoundingClientRect();
    volumeRef.current = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    volumeMutedRef.current = false;
    updateVolume();
    clearHideControlsTimeout();

    const handlePointerUp = (upEvent: PointerEvent) => {
      draggingVolumeBarRef.current = false;
      if (target.hasPointerCapture(pointerId)) {
        target.releasePointerCapture(pointerId);
      }

      const nextRect = volumeBarContainerRef.current?.getBoundingClientRect();
      if (!nextRect) {
        return;
      }

      volumeRef.current = clamp((upEvent.clientX - nextRect.left) / nextRect.width, 0, 1);
      updateVolume();
      showControlsTemporarily();
    };

    window.addEventListener('pointerup', handlePointerUp, { once: true });
  };

  const handleVolumePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingVolumeBarRef.current || !volumeBarContainerRef.current) {
      return;
    }

    const rect = volumeBarContainerRef.current.getBoundingClientRect();
    volumeRef.current = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    updateVolume();
  };

  const handleVolumeButtonClick = () => {
    volumeMutedRef.current = !volumeMutedRef.current;
    updateVolume();
  };

  const handleFullscreenClick = () => {
    if (!playerContainerRef.current) {
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      playerContainerRef.current.requestFullscreen().catch((fullscreenError) => {
        console.error('Failed to enter fullscreen mode:', fullscreenError);
      });
    }
  };

  const handlePlayerClick = () => {
    const isTouchDevice = 'ontouchstart' in window;

    if (isTouchDevice) {
      if (controlsVisible) {
        hideControls();
      } else {
        showControlsTemporarily();
      }
    } else {
      togglePlay();
    }
  };

  return (
    <section className={`player-example${unstyledMode ? ' player-example--unstyled' : ''}`}>
      <MovieList
        onSelectMovie={handleSelectMovie}
        inspectData={inspectData}
        unstyledMode={unstyledMode}
        onOpenInspect={handleOpenInspect}
        onToggleUnstyledMode={handleToggleUnstyledMode}
      />

      <p className="player-example__file-name">{fileName}</p>

      {fileName && <hr className="player-example__divider" />}

      {errorMessage && (
        <p className="player-example__message player-example__message--error">{errorMessage}</p>
      )}
      {warningMessage && (
        <p className="player-example__message player-example__message--warning">{warningMessage}</p>
      )}
      {loading && (
        <p className="player-example__message player-example__message--loading">Loading...</p>
      )}

      {playerVisible && (
        <div
          ref={playerContainerRef}
          className={`player-shell${playerTransparent ? ' player-shell--transparent' : ''}`}
          style={{ cursor: cursorHidden ? 'none' : 'default' }}
          onPointerMove={(event) => {
            if (event.pointerType !== 'touch') {
              showControlsTemporarily();
            }
          }}
          onPointerLeave={(event) => {
            if (!hasVideoRef.current || draggingProgressBarRef.current || draggingVolumeBarRef.current || event.pointerType === 'touch') {
              return;
            }

            hideControls();
            clearHideControlsTimeout();
          }}
          onClick={handlePlayerClick}
        >
          <canvas
            ref={canvasRef}
            className={`player-canvas${showCanvas ? '' : ' player-canvas--hidden'}`}
            width={1280}
            height={720}
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

      <InspectModal
        isOpen={inspectOpen}
        inspectData={inspectData}
        onClose={() => setInspectOpen(false)}
      />
    </section>
  );
};

export default VideoPlayer;
