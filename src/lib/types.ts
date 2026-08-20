export type AttachmentMeta = {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  url?: string;
  pathname?: string;
};

export type LatchNote = {
  id: string;
  title: string;
  body: string;
  sourceUrl?: string;
  attachments: AttachmentMeta[];
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LatchView = "all" | "pinned" | "files" | "archive";
