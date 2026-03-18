import {
  AttachedFile,
  Input,
  RichImageData,
  type InputAudioTrack,
  type InputTrack,
  type InputVideoTrack,
  type MetadataTags,
} from 'mediabunny';
import type { InspectAttachment, InspectTag, InspectData, MatroskaSubtitleSection, MatroskaTreeSection } from '../../components/VideoPlayer/types';
import { buildMatroskaInspectSections, isMatroskaFamilyFormat } from './matroska';

const formatInternalCodecId = (value: InputTrack['internalCodecId']) => {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  return Array.from(value)
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ');
};

const getDispositionFlags = (track: InputTrack) => {
  const entries = Object.entries(track.disposition).filter(([, enabled]) => enabled);
  return entries.map(([key]) => key);
};

const getTrackDetails = (track: InputTrack) => {
  if (track.isVideoTrack()) {
    const videoTrack = track as InputVideoTrack;
    return [
      `${videoTrack.displayWidth}x${videoTrack.displayHeight} display`,
      `${videoTrack.codedWidth}x${videoTrack.codedHeight} coded`,
      `rotation ${videoTrack.rotation}deg`,
      `pixel aspect ratio ${videoTrack.pixelAspectRatio.num}:${videoTrack.pixelAspectRatio.den}`,
    ];
  }

  if (track.isAudioTrack()) {
    const audioTrack = track as InputAudioTrack;
    return [
      `${audioTrack.numberOfChannels} channel${audioTrack.numberOfChannels === 1 ? '' : 's'}`,
      `${audioTrack.sampleRate} Hz`,
    ];
  }

  return [];
};

const getInspectableTags = (tags: MetadataTags) => {
  const inspectTags: InspectTag[] = [];

  for (const [key, value] of Object.entries(tags)) {
    if (value === undefined || key === 'raw' || key === 'images') {
      continue;
    }

    inspectTags.push({
      key,
      value: value instanceof Date ? value.toISOString() : String(value),
    });
  }

  if (tags.images?.length) {
    inspectTags.push({
      key: 'images',
      value: `${tags.images.length} embedded image${tags.images.length === 1 ? '' : 's'}`,
    });
  }

  return inspectTags;
};

const getInspectableAttachments = (tags: MetadataTags) => {
  const attachments: InspectAttachment[] = [];

  for (const [key, value] of Object.entries(tags.raw ?? {})) {
    if (value instanceof AttachedFile) {
      attachments.push({
        key,
        label: value.name ?? key,
        mimeType: value.mimeType ?? null,
        description: value.description ?? null,
        size: value.data.byteLength,
        kind: 'attachment',
      });
    } else if (value instanceof RichImageData) {
      attachments.push({
        key,
        label: key,
        mimeType: value.mimeType,
        description: null,
        size: value.data.byteLength,
        kind: 'image',
      });
    } else if (value instanceof Uint8Array) {
      attachments.push({
        key,
        label: key,
        mimeType: null,
        description: null,
        size: value.byteLength,
        kind: 'binary',
      });
    }
  }

  return attachments;
};

export const buildInspectData = async (
  input: Input,
  resource: File | string,
  duration: number,
): Promise<InspectData> => {
  const [format, mimeType, tags, tracks] = await Promise.all([
    input.getFormat(),
    input.getMimeType(),
    input.getMetadataTags(),
    input.getTracks(),
  ]);

  const inspectTracks = await Promise.all(
    tracks.map(async (track) => ({
      id: track.id,
      number: track.number,
      type: track.type,
      name: track.name,
      languageCode: track.languageCode,
      codec: track.codec ?? 'unknown',
      codecParameter: await track.getCodecParameterString(),
      internalCodecId: formatInternalCodecId(track.internalCodecId),
      duration: await track.computeDuration(),
      decodable: await track.canDecode(),
      dispositionFlags: getDispositionFlags(track),
      details: getTrackDetails(track),
    })),
  );

  const matroskaSections = isMatroskaFamilyFormat(format.name)
    ? await buildMatroskaInspectSections(resource).catch((error) => ({
        matroskaSubtitles: {
          note: `Failed to decode subtitle block data: ${String(error)}`,
          tracks: [],
        } satisfies MatroskaSubtitleSection,
        matroskaTree: {
          note: `Failed to build raw Matroska tree: ${String(error)}`,
          nodes: [],
        } satisfies MatroskaTreeSection,
      }))
    : null;

  return {
    fileLabel: resource instanceof File ? resource.name : resource,
    sourceKind: resource instanceof File ? 'local' : 'remote',
    fileSize: resource instanceof File ? resource.size : null,
    formatName: format.name,
    mimeType,
    duration,
    tracks: inspectTracks,
    tags: getInspectableTags(tags),
    attachments: getInspectableAttachments(tags),
    matroskaSubtitles: matroskaSections?.matroskaSubtitles ?? null,
    matroskaTree: matroskaSections?.matroskaTree ?? null,
  };
};
