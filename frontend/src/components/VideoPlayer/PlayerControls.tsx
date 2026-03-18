import type { RefObject } from 'react';
import { Maximize, Pause, Play, Volume1, Volume2, VolumeX } from 'lucide-react';
import type { VolumeIconLevel } from './types';

type PlayerControlsProps = {
  controlsVisible: boolean;
  playing: boolean;
  showVolumeControls: boolean;
  currentTimeText: string;
  durationText: string;
  progressPercent: number;
  volumePercent: number;
  volumeIconLevel: VolumeIconLevel;
  progressBarContainerRef: RefObject<HTMLDivElement | null>;
  volumeBarContainerRef: RefObject<HTMLDivElement | null>;
  showControlsTemporarily: () => void;
  togglePlay: () => void;
  handleVolumeButtonClick: () => void;
  handleProgressPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleProgressPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleVolumePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleVolumePointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleFullscreenClick: () => void;
};

export const PlayerControls = ({
  controlsVisible,
  playing,
  showVolumeControls,
  currentTimeText,
  durationText,
  progressPercent,
  volumePercent,
  volumeIconLevel,
  progressBarContainerRef,
  volumeBarContainerRef,
  showControlsTemporarily,
  togglePlay,
  handleVolumeButtonClick,
  handleProgressPointerDown,
  handleProgressPointerMove,
  handleVolumePointerDown,
  handleVolumePointerMove,
  handleFullscreenClick,
}: PlayerControlsProps) => {
  const volumeIcon = volumeIconLevel <= 1
    ? <VolumeX size={20} />
    : volumeIconLevel <= 3
      ? <Volume1 size={20} />
      : <Volume2 size={20} />;

  return (
    <div
      className={`player-controls${controlsVisible ? '' : ' player-controls--hidden'}`}
      onClick={(event) => {
        event.stopPropagation();
        showControlsTemporarily();
      }}
    >
      <button
        type="button"
        className="player-controls__button"
        onClick={togglePlay}
      >
        {playing ? <Pause size={20} /> : <Play size={20} />}
      </button>

      <div className={`player-volume${showVolumeControls ? '' : ' player-volume--hidden'}`}>
        <button
          type="button"
          className="player-controls__button"
          onClick={handleVolumeButtonClick}
        >
          {volumeIcon}
        </button>

        <div
          ref={volumeBarContainerRef}
          className="player-bar player-bar--volume"
          role="slider"
          aria-label="Volume"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(volumePercent)}
          tabIndex={0}
          onPointerDown={handleVolumePointerDown}
          onPointerMove={handleVolumePointerMove}
        >
          <div className="player-bar__fill" style={{ width: `${volumePercent}%` }}>
            <div className="player-bar__thumb" />
          </div>
        </div>
      </div>

      <p className="player-time player-time--current">{currentTimeText}</p>

      <div
        ref={progressBarContainerRef}
        className="player-bar player-bar--progress"
        role="slider"
        aria-label="Playback progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
        tabIndex={0}
        onPointerDown={handleProgressPointerDown}
        onPointerMove={handleProgressPointerMove}
      >
        <div className="player-bar__fill" style={{ width: `${progressPercent}%` }}>
          <div className="player-bar__thumb" />
        </div>
      </div>

      <p className="player-time">{durationText}</p>

      <button
        type="button"
        className="player-controls__button"
        onClick={handleFullscreenClick}
      >
        <Maximize size={20} />
      </button>
    </div>
  );
};
