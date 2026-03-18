import type { MatroskaTreeNode, MatroskaTreeSection, MatroskaSubtitleSection, MatroskaSubtitleTrackInfo } from '../../components/VideoPlayer/types';

export const MATROSKA_INSPECT_BYTE_LIMIT = 16 * 1024 * 1024;

export const MATROSKA_ELEMENT_NAMES: Record<number, string> = {
  0x1a45dfa3: 'EBML',
  0x4286: 'EBMLVersion',
  0x42f7: 'EBMLReadVersion',
  0x42f2: 'EBMLMaxIDLength',
  0x42f3: 'EBMLMaxSizeLength',
  0x4282: 'DocType',
  0x4287: 'DocTypeVersion',
  0x4285: 'DocTypeReadVersion',
  0x18538067: 'Segment',
  0x114d9b74: 'SeekHead',
  0x4dbb: 'Seek',
  0x53ab: 'SeekID',
  0x53ac: 'SeekPosition',
  0x1549a966: 'Info',
  0x2ad7b1: 'TimecodeScale',
  0x4489: 'Duration',
  0x4461: 'DateUTC',
  0x7ba9: 'Title',
  0x4d80: 'MuxingApp',
  0x5741: 'WritingApp',
  0x1654ae6b: 'Tracks',
  0xae: 'TrackEntry',
  0xd7: 'TrackNumber',
  0x73c5: 'TrackUID',
  0x83: 'TrackType',
  0xb9: 'FlagEnabled',
  0x88: 'FlagDefault',
  0x55aa: 'FlagForced',
  0x9c: 'FlagLacing',
  0x536e: 'Name',
  0x22b59c: 'Language',
  0x86: 'CodecID',
  0x63a2: 'CodecPrivate',
  0x258688: 'CodecName',
  0xe0: 'Video',
  0xb0: 'PixelWidth',
  0xba: 'PixelHeight',
  0x54b0: 'DisplayWidth',
  0x54ba: 'DisplayHeight',
  0x54b2: 'DisplayUnit',
  0x9a: 'FlagInterlaced',
  0xe1: 'Audio',
  0xb5: 'SamplingFrequency',
  0x9f: 'Channels',
  0x6264: 'BitDepth',
  0x1f43b675: 'Cluster',
  0xe7: 'Timestamp',
  0xa3: 'SimpleBlock',
  0xa0: 'BlockGroup',
  0xa1: 'Block',
  0xa4: 'CodecState',
  0x1c53bb6b: 'Cues',
  0xbb: 'CuePoint',
  0xb3: 'CueTime',
  0xb7: 'CueTrackPositions',
  0xf7: 'CueTrack',
  0xf1: 'CueClusterPosition',
  0xf0: 'CueRelativePosition',
  0x1941a469: 'Attachments',
  0x61a7: 'AttachedFile',
  0x467e: 'FileDescription',
  0x466e: 'FileName',
  0x4660: 'FileMimeType',
  0x465c: 'FileData',
  0x46ae: 'FileUID',
  0x1043a770: 'Chapters',
  0x45b9: 'EditionEntry',
  0xb6: 'ChapterAtom',
  0x73c4: 'ChapterUID',
  0x91: 'ChapterTimeStart',
  0x92: 'ChapterTimeEnd',
  0x80: 'ChapterDisplay',
  0x85: 'ChapString',
  0x437c: 'ChapLanguage',
  0x1254c367: 'Tags',
  0x7373: 'Tag',
  0x63c0: 'Targets',
  0x68ca: 'TargetTypeValue',
  0x67c8: 'SimpleTag',
  0x45a3: 'TagName',
  0x4487: 'TagString',
  0x4485: 'TagBinary',
};

export const MATROSKA_MASTER_IDS = new Set<number>([
  0x1a45dfa3,
  0x18538067,
  0x114d9b74,
  0x4dbb,
  0x1549a966,
  0x1654ae6b,
  0xae,
  0xe0,
  0xe1,
  0x1f43b675,
  0xa0,
  0x1c53bb6b,
  0xbb,
  0xb7,
  0x1941a469,
  0x61a7,
  0x1043a770,
  0x45b9,
  0xb6,
  0x80,
  0x1254c367,
  0x7373,
  0x63c0,
  0x67c8,
]);

export const MATROSKA_COLLAPSED_IDS = new Set<number>([
  0x1f43b675,
  0xa0,
  0xa1,
  0xa3,
  0x63a2,
  0x465c,
  0xa4,
]);

export const MATROSKA_TEXT_IDS = new Set<number>([
  0x4282,
  0x7ba9,
  0x4d80,
  0x5741,
  0x536e,
  0x22b59c,
  0x86,
  0x258688,
  0x467e,
  0x466e,
  0x4660,
  0x85,
  0x437c,
  0x45a3,
  0x4487,
]);

export const MATROSKA_FLOAT_IDS = new Set<number>([
  0x4489,
  0xb5,
]);

export const MATROSKA_INT_IDS = new Set<number>([
  0x4286,
  0x42f7,
  0x42f2,
  0x42f3,
  0x4287,
  0x4285,
  0x2ad7b1,
  0xd7,
  0x73c5,
  0x83,
  0xb9,
  0x88,
  0x55aa,
  0x9c,
  0xb0,
  0xba,
  0x54b0,
  0x54ba,
  0x54b2,
  0x9a,
  0x9f,
  0x6264,
  0xe7,
  0xb3,
  0xf7,
  0xf1,
  0xf0,
  0x46ae,
  0x73c4,
  0x91,
  0x92,
  0x68ca,
]);

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = -1;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

export const readEbmlVint = (
  data: Uint8Array,
  offset: number,
  preserveMarkerBits: boolean,
) => {
  if (offset >= data.length) {
    return null;
  }

  const firstByte = data[offset];
  let mask = 0x80;
  let length = 1;

  while (length <= 8 && (firstByte & mask) === 0) {
    mask >>= 1;
    length += 1;
  }

  if (length > 8 || offset + length > data.length) {
    return null;
  }

  let value = preserveMarkerBits ? BigInt(firstByte) : BigInt(firstByte & (mask - 1));

  for (let index = 1; index < length; index += 1) {
    value = (value << 8n) | BigInt(data[offset + index]);
  }

  const allOnes = !preserveMarkerBits && value === (1n << BigInt(7 * length)) - 1n;

  return {
    length,
    value,
    unknown: allOnes,
  };
};

export const readEbmlUnsigned = (data: Uint8Array) => {
  let value = 0n;
  for (const byte of data) {
    value = (value << 8n) | BigInt(byte);
  }
  return value;
};

export const readEbmlFloat = (data: Uint8Array) => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  if (data.byteLength === 4) {
    return view.getFloat32(0, false);
  }

  if (data.byteLength === 8) {
    return view.getFloat64(0, false);
  }

  return null;
};

export const decodeUtf8 = (data: Uint8Array) => {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(data).replace(/\0+$/g, '');
  } catch {
    return null;
  }
};

export const getMatroskaValuePreview = (id: number, payload: Uint8Array) => {
  if (payload.length === 0) {
    return null;
  }

  if (MATROSKA_TEXT_IDS.has(id)) {
    return decodeUtf8(payload);
  }

  if (MATROSKA_FLOAT_IDS.has(id)) {
    const value = readEbmlFloat(payload);
    return value === null ? null : String(value);
  }

  if (MATROSKA_INT_IDS.has(id) && payload.length <= 8) {
    return readEbmlUnsigned(payload).toString();
  }

  if (payload.length <= 8 && !MATROSKA_MASTER_IDS.has(id)) {
    return `0x${Array.from(payload).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }

  if (payload.length > 0) {
    return `${formatBytes(payload.length)} binary`;
  }

  return null;
};

export const parseMatroskaNodes = (
  data: Uint8Array,
  startOffset: number,
  endOffset: number,
  depth: number,
  nodeBudgetRef: { value: number },
): MatroskaTreeNode[] => {
  const nodes: MatroskaTreeNode[] = [];
  let cursor = startOffset;

  while (cursor < endOffset && nodeBudgetRef.value > 0) {
    const idVint = readEbmlVint(data, cursor, true);
    if (!idVint) {
      break;
    }

    const sizeVint = readEbmlVint(data, cursor + idVint.length, false);
    if (!sizeVint) {
      break;
    }

    const payloadOffset = cursor + idVint.length + sizeVint.length;
    const rawSize = sizeVint.unknown ? null : Number(sizeVint.value);
    const payloadEnd = rawSize === null
      ? endOffset
      : Math.min(endOffset, payloadOffset + rawSize);

    if (payloadOffset > endOffset || payloadEnd < payloadOffset) {
      break;
    }

    const idNumber = Number(idVint.value);
    const payload = data.subarray(payloadOffset, payloadEnd);
    const isMaster = MATROSKA_MASTER_IDS.has(idNumber);
    const shouldCollapse = MATROSKA_COLLAPSED_IDS.has(idNumber) || depth >= 4;

    nodeBudgetRef.value -= 1;

    nodes.push({
      idHex: `0x${idNumber.toString(16).toUpperCase()}`,
      name: MATROSKA_ELEMENT_NAMES[idNumber] ?? 'Unknown',
      size: rawSize,
      offset: cursor,
      valuePreview: isMaster ? null : getMatroskaValuePreview(idNumber, payload),
      children: isMaster && !shouldCollapse
        ? parseMatroskaNodes(data, payloadOffset, payloadEnd, depth + 1, nodeBudgetRef)
        : null,
    });

    cursor = payloadEnd;

    if (rawSize === null) {
      break;
    }
  }

  return nodes;
};

export const scanEbmlElements = (
  data: Uint8Array,
  startOffset: number,
  endOffset: number,
  visitor: (element: {
    id: number;
    payloadOffset: number;
    payloadEnd: number;
    rawSize: number | null;
    offset: number;
  }) => void,
) => {
  let cursor = startOffset;

  while (cursor < endOffset) {
    const idVint = readEbmlVint(data, cursor, true);
    if (!idVint) {
      break;
    }

    const sizeVint = readEbmlVint(data, cursor + idVint.length, false);
    if (!sizeVint) {
      break;
    }

    const payloadOffset = cursor + idVint.length + sizeVint.length;
    const rawSize = sizeVint.unknown ? null : Number(sizeVint.value);
    const payloadEnd = rawSize === null
      ? endOffset
      : Math.min(endOffset, payloadOffset + rawSize);

    if (payloadOffset > endOffset || payloadEnd < payloadOffset) {
      break;
    }

    visitor({
      id: Number(idVint.value),
      payloadOffset,
      payloadEnd,
      rawSize,
      offset: cursor,
    });

    cursor = payloadEnd;

    if (rawSize === null) {
      break;
    }
  }
};

export const parseMatroskaTrackEntry = (data: Uint8Array, startOffset: number, endOffset: number) => {
  let trackNumber: number | null = null;
  let trackType: number | null = null;
  let codecId: string | null = null;
  let language = 'und';
  let name: string | null = null;
  let isDefault = true;
  let isForced = false;

  scanEbmlElements(data, startOffset, endOffset, ({ id, payloadOffset, payloadEnd }) => {
    const payload = data.subarray(payloadOffset, payloadEnd);

    if (id === 0xd7) {
      trackNumber = Number(readEbmlUnsigned(payload));
    } else if (id === 0x83) {
      trackType = Number(readEbmlUnsigned(payload));
    } else if (id === 0x86) {
      codecId = decodeUtf8(payload);
    } else if (id === 0x22b59c) {
      language = decodeUtf8(payload) ?? 'und';
    } else if (id === 0x536e) {
      name = decodeUtf8(payload);
    } else if (id === 0x88) {
      isDefault = Number(readEbmlUnsigned(payload)) !== 0;
    } else if (id === 0x55aa) {
      isForced = Number(readEbmlUnsigned(payload)) !== 0;
    }
  });

  if (trackNumber === null || trackType === null || codecId === null) {
    return null;
  }

  return {
    trackNumber,
    trackType,
    codecId,
    language,
    name,
    isDefault,
    isForced,
  };
};

export const buildMatroskaSubtitleLabel = (track: MatroskaSubtitleTrackInfo) => {
  const parts = [track.name, track.language, track.codecId].filter(Boolean);
  return parts.join(' | ');
};

export const buildMatroskaSubtitleSectionFromBytes = (
  data: Uint8Array,
  truncated: boolean,
  sourceLabel: string,
) => {
  const subtitleTracks = new Map<number, MatroskaSubtitleTrackInfo>();

  const parseSegment = (startOffset: number, endOffset: number) => {
    scanEbmlElements(data, startOffset, endOffset, ({ id, payloadOffset, payloadEnd, offset }) => {
      if (id === 0x1654ae6b) {
        scanEbmlElements(data, payloadOffset, payloadEnd, ({ id: tracksId, payloadOffset: trackStart, payloadEnd: trackEnd }) => {
          if (tracksId !== 0xae) {
            return;
          }

          const parsedTrack = parseMatroskaTrackEntry(data, trackStart, trackEnd);
          if (parsedTrack && parsedTrack.trackType === 17) {
            subtitleTracks.set(parsedTrack.trackNumber, {
              trackNumber: parsedTrack.trackNumber,
              codecId: parsedTrack.codecId,
              language: parsedTrack.language,
              name: parsedTrack.name,
              isDefault: parsedTrack.isDefault,
              isForced: parsedTrack.isForced,
            });
          }
        });
      } else if (id === 0x18538067 && offset !== startOffset) {
        parseSegment(payloadOffset, payloadEnd);
      }
    });
  };

  scanEbmlElements(data, 0, data.length, ({ id, payloadOffset, payloadEnd }) => {
    if (id === 0x18538067) {
      parseSegment(payloadOffset, payloadEnd);
    }
  });

  let note = `Detected subtitle streams from ${sourceLabel} track metadata.`;
  if (truncated) {
    note += ` Results only cover the first ${formatBytes(MATROSKA_INSPECT_BYTE_LIMIT)} of the file.`;
  }
  if (subtitleTracks.size === 0) {
    note += ' No subtitle tracks were detected in the parsed Matroska metadata.';
  }

  return {
    note,
    tracks: [...subtitleTracks.values()].sort((left, right) => left.trackNumber - right.trackNumber),
  } satisfies MatroskaSubtitleSection;
};

export const readMatroskaInspectBytes = async (resource: File | string) => {
  if (resource instanceof File) {
    const slice = resource.slice(0, MATROSKA_INSPECT_BYTE_LIMIT);
    const buffer = await slice.arrayBuffer();
    return {
      bytes: new Uint8Array(buffer),
      truncated: resource.size > MATROSKA_INSPECT_BYTE_LIMIT,
      sourceLabel: 'local file prefix',
    };
  }

  const response = await fetch(resource, {
    headers: {
      Range: `bytes=0-${MATROSKA_INSPECT_BYTE_LIMIT - 1}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Matroska bytes: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const contentRange = response.headers.get('content-range');
  const truncated = contentRange !== null || buffer.byteLength >= MATROSKA_INSPECT_BYTE_LIMIT;

  return {
    bytes: new Uint8Array(buffer),
    truncated,
    sourceLabel: 'remote file prefix',
  };
};

export const buildMatroskaInspectSections = async (resource: File | string) => {
  const { bytes, truncated, sourceLabel } = await readMatroskaInspectBytes(resource);
  const nodeBudgetRef = { value: 400 };
  const nodes = parseMatroskaNodes(bytes, 0, bytes.length, 0, nodeBudgetRef);

  let note = `Parsed EBML tree from the ${sourceLabel}.`;
  if (truncated) {
    note += ` Only the first ${formatBytes(MATROSKA_INSPECT_BYTE_LIMIT)} are shown, so later clusters may be omitted.`;
  }
  if (nodeBudgetRef.value <= 0) {
    note += ' Tree output was capped to keep the inspector responsive.';
  }

  return {
    matroskaSubtitles: buildMatroskaSubtitleSectionFromBytes(bytes, truncated, sourceLabel),
    matroskaTree: {
      note,
      nodes,
    } satisfies MatroskaTreeSection,
  };
};

export const isMatroskaFamilyFormat = (formatName: string) =>
  formatName === 'Matroska' || formatName === 'WebM';
