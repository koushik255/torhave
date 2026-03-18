import type { InspectData, MatroskaTreeNode } from '../../components/VideoPlayer/types';
import { formatBytes, buildMatroskaSubtitleLabel } from './matroska';

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

type InspectModalProps = {
  isOpen: boolean;
  inspectData: InspectData | null;
  onClose: () => void;
};

const renderMatroskaNode = (node: MatroskaTreeNode, depth = 0): React.ReactNode => (
  <div key={`${node.offset}-${node.idHex}-${depth}`} className="inspect-tree__node">
    <div className="inspect-tree__line" style={{ paddingLeft: `${depth * 1.1}rem` }}>
      <span className="inspect-tree__name">{node.name}</span>
      <span className="inspect-tree__meta">{node.idHex}</span>
      <span className="inspect-tree__meta">
        {node.size === null ? 'unknown size' : formatBytes(node.size)}
      </span>
      <span className="inspect-tree__meta">@{node.offset}</span>
      {node.valuePreview && (
        <span className="inspect-tree__value">{node.valuePreview}</span>
      )}
    </div>
    {node.children?.map((childNode) => renderMatroskaNode(childNode, depth + 1))}
  </div>
);

export const InspectModal = ({ isOpen, inspectData, onClose }: InspectModalProps) => {
  if (!isOpen || !inspectData) {
    return null;
  }

  return (
    <div className="inspect-modal" onClick={onClose}>
      <div className="inspect-modal__dialog" onClick={(event) => event.stopPropagation()}>
        <div className="inspect-modal__header">
          <div>
            <h2 className="inspect-modal__title">Container inspection</h2>
            <p className="inspect-modal__subtitle">
              Showing container metadata and MediaBunny-visible tracks for the loaded file.
            </p>
          </div>
          <button type="button" className="inspect-modal__close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="inspect-modal__section">
          <div className="inspect-grid">
            <div>
              <span className="inspect-grid__label">File</span>
              <span className="inspect-grid__value">{inspectData.fileLabel}</span>
            </div>
            <div>
              <span className="inspect-grid__label">Source</span>
              <span className="inspect-grid__value">{inspectData.sourceKind}</span>
            </div>
            <div>
              <span className="inspect-grid__label">Container</span>
              <span className="inspect-grid__value">{inspectData.formatName}</span>
            </div>
            <div>
              <span className="inspect-grid__label">MIME type</span>
              <span className="inspect-grid__value">{inspectData.mimeType}</span>
            </div>
            <div>
              <span className="inspect-grid__label">Duration</span>
              <span className="inspect-grid__value">{formatSeconds(inspectData.duration)}</span>
            </div>
            <div>
              <span className="inspect-grid__label">Size</span>
              <span className="inspect-grid__value">
                {inspectData.fileSize === null ? 'Unknown' : formatBytes(inspectData.fileSize)}
              </span>
            </div>
          </div>
        </div>

        <div className="inspect-modal__section">
          <h3 className="inspect-modal__section-title">Tracks</h3>
          {inspectData.tracks.length === 0 ? (
            <p className="inspect-modal__empty">No inspectable tracks found.</p>
          ) : (
            <div className="inspect-list">
              {inspectData.tracks.map((track) => (
                <div key={`${track.type}-${track.id}`} className="inspect-card">
                  <div className="inspect-card__header">
                    <strong>
                      {track.type} track #{track.number}
                    </strong>
                    <span className={`inspect-badge${track.decodable ? '' : ' inspect-badge--muted'}`}>
                      {track.decodable ? 'decodable' : 'not decodable'}
                    </span>
                  </div>
                  <div className="inspect-card__rows">
                    <p><span>ID:</span> {track.id}</p>
                    <p><span>Name:</span> {track.name ?? 'None'}</p>
                    <p><span>Language:</span> {track.languageCode}</p>
                    <p><span>Codec:</span> {track.codec}</p>
                    <p><span>Codec string:</span> {track.codecParameter ?? 'Unknown'}</p>
                    <p><span>Container codec id:</span> {track.internalCodecId ?? 'Unknown'}</p>
                    <p><span>Duration:</span> {formatSeconds(track.duration)}</p>
                    <p><span>Disposition:</span> {track.dispositionFlags.join(', ') || 'None'}</p>
                    {track.details.map((detail) => (
                      <p key={detail}><span>Detail:</span> {detail}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="inspect-modal__section">
          <h3 className="inspect-modal__section-title">Tags</h3>
          {inspectData.tags.length === 0 ? (
            <p className="inspect-modal__empty">No container tags found.</p>
          ) : (
            <div className="inspect-list">
              {inspectData.tags.map((tag) => (
                <div key={tag.key} className="inspect-card inspect-card--compact">
                  <p><span>{tag.key}:</span> {tag.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="inspect-modal__section">
          <h3 className="inspect-modal__section-title">Attachments</h3>
          {inspectData.attachments.length === 0 ? (
            <p className="inspect-modal__empty">No attached files or binary payloads found.</p>
          ) : (
            <div className="inspect-list">
              {inspectData.attachments.map((attachment) => (
                <div key={attachment.key} className="inspect-card inspect-card--compact">
                  <p><span>Label:</span> {attachment.label}</p>
                  <p><span>Kind:</span> {attachment.kind}</p>
                  <p><span>MIME type:</span> {attachment.mimeType ?? 'Unknown'}</p>
                  <p><span>Description:</span> {attachment.description ?? 'None'}</p>
                  <p><span>Size:</span> {formatBytes(attachment.size)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {inspectData.matroskaSubtitles && (
          <div className="inspect-modal__section">
            <h3 className="inspect-modal__section-title">Subtitle streams</h3>
            <p className="inspect-modal__empty">{inspectData.matroskaSubtitles.note}</p>
            {inspectData.matroskaSubtitles.tracks.length === 0 ? (
              <p className="inspect-modal__empty">No subtitle variants were found in the parsed track metadata.</p>
            ) : (
              <div className="inspect-list">
                {inspectData.matroskaSubtitles.tracks.map((track) => (
                  <div
                    key={`${track.trackNumber}-${track.language}-${track.codecId}`}
                    className="inspect-card inspect-card--compact"
                  >
                    <p><span>Track:</span> #{track.trackNumber}</p>
                    <p><span>Name:</span> {track.name ?? 'None'}</p>
                    <p><span>Language:</span> {track.language}</p>
                    <p><span>Codec:</span> {track.codecId}</p>
                    <p><span>Default:</span> {track.isDefault ? 'Yes' : 'No'}</p>
                    <p><span>Forced:</span> {track.isForced ? 'Yes' : 'No'}</p>
                    <p><span>Summary:</span> {buildMatroskaSubtitleLabel(track)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {inspectData.matroskaTree && (
          <div className="inspect-modal__section">
            <h3 className="inspect-modal__section-title">Matroska raw tree</h3>
            <p className="inspect-modal__empty">{inspectData.matroskaTree.note}</p>
            {inspectData.matroskaTree.nodes.length === 0 ? (
              <p className="inspect-modal__empty">No Matroska nodes were parsed from the available bytes.</p>
            ) : (
              <div className="inspect-tree">
                {inspectData.matroskaTree.nodes.map((node) => renderMatroskaNode(node))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
