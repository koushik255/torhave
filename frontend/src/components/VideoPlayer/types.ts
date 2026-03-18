export type VolumeIconLevel = 0 | 1 | 2 | 3 | 4;

export type InspectTrack = {
  id: number;
  number: number;
  type: string;
  name: string | null;
  languageCode: string;
  codec: string;
  codecParameter: string | null;
  internalCodecId: string | null;
  duration: number;
  decodable: boolean;
  dispositionFlags: string[];
  details: string[];
};

export type InspectAttachment = {
  key: string;
  label: string;
  mimeType: string | null;
  description: string | null;
  size: number;
  kind: 'attachment' | 'image' | 'binary';
};

export type InspectTag = {
  key: string;
  value: string;
};

export type MatroskaTreeNode = {
  idHex: string;
  name: string;
  size: number | null;
  offset: number;
  valuePreview: string | null;
  children: MatroskaTreeNode[] | null;
};

export type MatroskaTreeSection = {
  note: string;
  nodes: MatroskaTreeNode[];
};

export type MatroskaSubtitleTrackInfo = {
  trackNumber: number;
  codecId: string;
  language: string;
  name: string | null;
  isDefault: boolean;
  isForced: boolean;
};

export type MatroskaSubtitleSection = {
  note: string;
  tracks: MatroskaSubtitleTrackInfo[];
};

export type InspectData = {
  fileLabel: string;
  sourceKind: 'local' | 'remote';
  fileSize: number | null;
  formatName: string;
  mimeType: string;
  duration: number;
  tracks: InspectTrack[];
  tags: InspectTag[];
  attachments: InspectAttachment[];
  matroskaSubtitles: MatroskaSubtitleSection | null;
  matroskaTree: MatroskaTreeSection | null;
};
