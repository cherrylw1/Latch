import type { LatchNote } from "@/lib/types";

const now = new Date();
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

export const seedNotes: LatchNote[] = [
  {
    id: "seed-planning",
    title: "Monday planning",
    body: "Finish the project brief, send the revised deck, and keep the research links together here.\n\nUse this space for useful scraps that need to move between machines.",
    attachments: [],
    pinned: true,
    archived: false,
    createdAt: ago(85),
    updatedAt: ago(18),
  },
  {
    id: "seed-link",
    title: "Reference worth keeping",
    body: "The underlying idea is simple: make information easy to drop, easy to find, and easy to take back out.",
    sourceUrl: "https://vercel.com/docs",
    attachments: [],
    pinned: false,
    archived: false,
    createdAt: ago(360),
    updatedAt: ago(360),
  },
  {
    id: "seed-handoff",
    title: "Hand-off notes",
    body: "Keep the next action at the top. Add context underneath only when it will save future time.",
    attachments: [],
    pinned: false,
    archived: false,
    createdAt: ago(1_280),
    updatedAt: ago(1_280),
  },
];
