"use client";

import {
  Archive,
  ArrowLeft,
  ArrowClockwise,
  ArrowSquareOut,
  Check,
  CircleNotch,
  Copy,
  DownloadSimple,
  File,
  FileArrowUp,
  FileCsv,
  FilePdf,
  FileText,
  FolderSimple,
  Image as ImageIcon,
  LinkSimple,
  MagnifyingGlass,
  Moon,
  NoteBlank,
  Paperclip,
  Plus,
  PushPin,
  SignOut,
  Sun,
  Trash,
  X,
} from "@phosphor-icons/react";
import { zipSync, strToU8 } from "fflate";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAllAttachments,
  getAttachment,
  getNotes,
  getStorageMode,
  removeAttachment,
  removeNote,
  saveAttachments,
  saveNote,
} from "@/lib/storage";
import { seedNotes } from "@/lib/seed";
import type { AttachmentMeta, LatchNote, LatchView } from "@/lib/types";

type Draft = {
  title: string;
  body: string;
  sourceUrl: string;
};

type Preview = {
  attachment: AttachmentMeta;
  url: string;
  csvRows?: string[][];
};

const emptyDraft: Draft = { title: "", body: "", sourceUrl: "" };
const maximumFileSize = 2 * 1024 * 1024 * 1024;

const navigation: Array<{
  id: LatchView;
  label: string;
  icon: typeof NoteBlank;
}> = [
  { id: "all", label: "All notes", icon: NoteBlank },
  { id: "pinned", label: "Pinned", icon: PushPin },
  { id: "files", label: "Files", icon: FolderSimple },
  { id: "archive", label: "Archive", icon: Archive },
];

function formatTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  const diff = today.getTime() - date.getTime();
  if (diff < 60 * 60 * 1000) return "just now";
  if (diff < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / 3_600_000))}h ago`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.round(diff / 86_400_000)}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function normaliseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return undefined;
  }
}

function noteTitle(note: LatchNote) {
  return note.title.trim() || note.body.split("\n").find(Boolean)?.slice(0, 70) || "Untitled note";
}

function fileIcon(type: string, size = 18) {
  const common = { size, weight: "regular" as const };
  if (type.includes("csv") || type.includes("spreadsheet")) return <FileCsv {...common} />;
  if (type.includes("pdf")) return <FilePdf {...common} />;
  if (type.startsWith("image/")) return <ImageIcon {...common} />;
  if (type.startsWith("text/") || type.includes("json") || type.includes("markdown")) return <FileText {...common} />;
  return <File {...common} />;
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function initialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const persistedTheme = window.localStorage.getItem("latch-theme");
  if (persistedTheme === "light" || persistedTheme === "dark") return persistedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function LatchApp() {
  const router = useRouter();
  const [notes, setNotes] = useState<LatchNote[]>([]);
  const [view, setView] = useState<LatchView>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);
  const [preview, setPreview] = useState<Preview | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    getNotes()
      .then(async (storedNotes) => {
        if (storedNotes.length || getStorageMode() === "remote") return storedNotes;
        await Promise.all(seedNotes.map((note) => saveNote(note)));
        return seedNotes;
      })
      .then((storedNotes) => {
        setNotes(storedNotes);
        setSelectedId(storedNotes[0]?.id ?? null);
      })
      .catch(() => setNotice("Latch could not open local storage. Try refreshing the page."))
      .finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("latch-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey && document.activeElement?.tagName !== "TEXTAREA") {
        setComposerOpen(true);
      }
      if (event.key === "Escape") {
        setMobileInspectorOpen(false);
        setPreview((activePreview) => {
          if (activePreview) URL.revokeObjectURL(activePreview.url);
          return null;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3_600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!mobileInspectorOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileInspectorOpen]);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...notes]
      .filter((note) => {
        if (view === "all") return !note.archived;
        if (view === "pinned") return !note.archived && note.pinned;
        if (view === "files") return !note.archived && note.attachments.length > 0;
        return note.archived;
      })
      .filter((note) => {
        if (!query) return true;
        return [note.title, note.body, note.sourceUrl, ...note.attachments.map((attachment) => attachment.name)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [notes, search, view]);

  const selected = notes.find((note) => note.id === selectedId) ?? filteredNotes[0] ?? null;
  const activeViewLabel = navigation.find((item) => item.id === view)?.label ?? "All notes";
  const fileCount = notes.filter((note) => !note.archived).reduce((sum, note) => sum + note.attachments.length, 0);

  function selectNote(noteId: string) {
    setSelectedId(noteId);
    if (window.matchMedia("(max-width: 760px)").matches) setMobileInspectorOpen(true);
  }

  function updateDraft(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function resetComposer() {
    setDraft(emptyDraft);
    setPendingFiles([]);
    setComposerOpen(false);
  }

  function addFiles(files: FileList | File[]) {
    const usableFiles = Array.from(files).filter((file) => file.size <= maximumFileSize);
    const rejected = Array.from(files).length - usableFiles.length;
    if (rejected) setNotice(`${rejected} file${rejected > 1 ? "s are" : " is"} over the 2 GB limit.`);
    setPendingFiles((current) => [...current, ...usableFiles]);
    if (usableFiles.length) setComposerOpen(true);
  }

  async function createNote() {
    const sourceUrl = normaliseUrl(draft.sourceUrl);
    if (!draft.title.trim() && !draft.body.trim() && !sourceUrl && !pendingFiles.length) {
      setNotice("Add a note, link, or file first.");
      return;
    }
    setIsSaving(true);
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    try {
      const attachments = await saveAttachments(id, pendingFiles);
      const note: LatchNote = {
        id,
        title: draft.title.trim() || pendingFiles[0]?.name.replace(/\.[^/.]+$/, "") || "Untitled note",
        body: draft.body.trim(),
        sourceUrl,
        attachments,
        pinned: false,
        archived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await saveNote(note);
      setNotes((current) => [note, ...current]);
      setSelectedId(note.id);
      resetComposer();
      setNotice("Added to Latch.");
    } catch {
      setNotice("Latch could not save this note. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateNote(next: LatchNote) {
    await saveNote(next);
    setNotes((current) => current.map((note) => (note.id === next.id ? next : note)));
  }

  async function togglePinned(note: LatchNote) {
    await updateNote({ ...note, pinned: !note.pinned, updatedAt: new Date().toISOString() });
  }

  async function archiveNote(note: LatchNote) {
    await updateNote({ ...note, archived: !note.archived, updatedAt: new Date().toISOString() });
    setNotice(note.archived ? "Restored to your notes." : "Moved to archive.");
  }

  async function deleteNote(note: LatchNote) {
    if (!window.confirm(`Delete “${noteTitle(note)}”? This cannot be undone.`)) return;
    await removeNote(note.id);
    setNotes((current) => current.filter((item) => item.id !== note.id));
    setSelectedId(null);
    setMobileInspectorOpen(false);
    setNotice("Note deleted.");
  }

  async function deleteAttachment(note: LatchNote, attachment: AttachmentMeta) {
    await removeAttachment(attachment.id);
    const next = {
      ...note,
      attachments: note.attachments.filter((item) => item.id !== attachment.id),
      updatedAt: new Date().toISOString(),
    };
    await updateNote(next);
    setNotice("Attachment removed.");
  }

  async function openAttachment(attachment: AttachmentMeta) {
    const stored = await getAttachment(attachment.id);
    if (!stored) {
      setNotice("This attachment is no longer available locally.");
      return;
    }
    const isPreviewable =
      stored.type.startsWith("image/") || stored.type.includes("pdf") || stored.type.startsWith("text/") || stored.type.includes("csv") || stored.type.includes("json");
    if (!isPreviewable) {
      triggerDownload(stored.blob, stored.name);
      return;
    }
    const url = URL.createObjectURL(stored.blob);
    let csvRows: string[][] | undefined;
    if (stored.type.includes("csv") || stored.name.toLowerCase().endsWith(".csv")) {
      const text = await stored.blob.text();
      csvRows = Papa.parse<string[]>(text, { skipEmptyLines: true, preview: 12 }).data;
    }
    setPreview({ attachment, url, csvRows });
  }

  async function downloadAttachment(attachment: AttachmentMeta) {
    const stored = await getAttachment(attachment.id);
    if (!stored) return setNotice("This attachment is no longer available locally.");
    triggerDownload(stored.blob, stored.name);
  }

  function downloadNotes() {
    triggerDownload(new Blob([JSON.stringify(notes, null, 2)], { type: "application/json" }), "latch-notes.json");
    setNotice("Notes export downloaded.");
  }

  async function copyText(value: string, label: string) {
    if (!value.trim()) {
      setNotice(`${label} is empty.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch {
      setNotice(`Latch could not copy the ${label.toLowerCase()}.`);
    }
  }

  async function downloadEverything() {
    setIsSaving(true);
    try {
      const attachments = await getAllAttachments();
      const files: Record<string, Uint8Array> = {
        "Latch/notes.json": strToU8(JSON.stringify(notes, null, 2)),
      };
      await Promise.all(
        attachments.map(async (attachment) => {
          const safePath = (attachment.relativePath || attachment.name)
            .split(/[\\/]/)
            .filter((part) => part && part !== "." && part !== "..")
            .map((part) => part.replace(/[\\:*?"<>|]/g, "-"))
            .join("/");
          files[`Latch/files/${safePath || attachment.name}`] = new Uint8Array(await attachment.blob.arrayBuffer());
        }),
      );
      triggerDownload(new Blob([zipSync(files, { level: 0 })], { type: "application/zip" }), "latch-backup.zip");
      setNotice("Full backup downloaded.");
    } catch {
      setNotice("The backup could not be created. Try exporting smaller sets of files.");
    } finally {
      setIsSaving(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  function closePreview() {
    setPreview((activePreview) => {
      if (activePreview) URL.revokeObjectURL(activePreview.url);
      return null;
    });
  }

  const noteMotion = reduceMotion ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };

  return (
    <main className="app-shell">
      <aside className="side-rail" aria-label="Latch navigation">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><i /><i /></span>
          <span>Latch</span>
        </div>

        <button className="new-note-button" type="button" onClick={() => setComposerOpen(true)}>
          <Plus size={18} weight="bold" />
          <span className="new-note-label">New note</span>
          <kbd>N</kbd>
        </button>

        <nav className="navigation-list">
          {navigation.map((item) => {
            const Icon = item.icon;
            const count = item.id === "files" ? fileCount : item.id === "pinned" ? notes.filter((note) => note.pinned && !note.archived).length : undefined;
            return (
              <button
                className={`nav-item ${view === item.id ? "is-active" : ""}`}
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
              >
                <Icon size={18} weight="regular" />
                <span>{item.label}</span>
                {count ? <small>{count}</small> : null}
              </button>
            );
          })}
        </nav>

        <div className="rail-footer">
          <button className="quiet-button" type="button" onClick={downloadEverything} disabled={isSaving}>
            <DownloadSimple size={18} />
            Download all
          </button>
          <button className="theme-button" type="button" onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} aria-label="Toggle color theme">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === "dark" ? "Light canvas" : "Dark canvas"}</span>
          </button>
          <button className="quiet-button" type="button" onClick={() => void signOut()}>
            <SignOut size={18} />
            Lock Latch
          </button>
        </div>
      </aside>

      <section className="workbench">
        <div className="mobile-brand-lockup">
          <span className="brand-mark" aria-hidden="true"><i /><i /></span>
          <span>Latch</span>
          <small>personal relay</small>
        </div>
        <header className="workspace-header">
          <div>
            <p className="workspace-kicker">Your personal relay</p>
            <h1>{activeViewLabel}</h1>
          </div>
          <label className="search-field">
            <MagnifyingGlass size={18} />
            <input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes and files" aria-label="Search notes and files" />
            <kbd>⌘ K</kbd>
          </label>
        </header>

        <AnimatePresence initial={false}>
          {composerOpen ? (
            <motion.section
              className={`capture-desk ${isDragging ? "is-dragging" : ""}`}
              initial={reduceMotion ? false : { opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                addFiles(event.dataTransfer.files);
              }}
            >
              <div className="capture-heading">
                <div>
                  <span className="capture-mark"><Plus size={17} weight="bold" /></span>
                  <span>Drop something worth keeping</span>
                </div>
                <button className="icon-button" type="button" onClick={resetComposer} aria-label="Close new note"><X size={18} /></button>
              </div>
              <label className="capture-title-label" htmlFor="note-title">Title</label>
              <input id="note-title" className="capture-title" value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} placeholder="Give it a handle" />
              <label className="capture-body-label" htmlFor="note-body">Note</label>
              <textarea id="note-body" className="capture-body" value={draft.body} onChange={(event) => updateDraft("body", event.target.value)} placeholder="Paste a thought, a meeting note, a link explanation..." rows={4} />
              <div className="capture-footer">
                <div className="capture-tools">
                  <button className="tool-button" type="button" onClick={() => fileInput.current?.click()}>
                    <Paperclip size={18} />
                    Attach files
                  </button>
                  <button className="tool-button" type="button" onClick={() => folderInput.current?.click()}>
                    <FolderSimple size={18} />
                    Attach folder
                  </button>
                  <label className="link-input">
                    <LinkSimple size={17} />
                    <input value={draft.sourceUrl} onChange={(event) => updateDraft("sourceUrl", event.target.value)} placeholder="Add a link" aria-label="Source link" />
                  </label>
                </div>
                <button className="save-button" type="button" onClick={createNote} disabled={isSaving}>
                  {isSaving ? <CircleNotch size={18} className="spin" /> : <Check size={18} weight="bold" />}
                  Save note
                </button>
              </div>
              {pendingFiles.length ? (
                <div className="pending-files">
                  {pendingFiles.map((file) => (
                    <span className="pending-file" key={`${file.name}-${file.lastModified}`}>
                      {fileIcon(file.type, 16)}
                      <span>{file.name}</span>
                      <button type="button" onClick={() => setPendingFiles((current) => current.filter((item) => item !== file))} aria-label={`Remove ${file.name}`}><X size={14} /></button>
                    </span>
                  ))}
                </div>
              ) : null}
              <input ref={fileInput} className="visually-hidden" type="file" multiple onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.currentTarget.value = ""; }} />
              <input ref={(node) => { folderInput.current = node; node?.setAttribute("webkitdirectory", ""); node?.setAttribute("directory", ""); }} className="visually-hidden" type="file" multiple onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.currentTarget.value = ""; }} />
            </motion.section>
          ) : null}
        </AnimatePresence>

        <section className="notes-stage" aria-live="polite">
          {!isLoaded ? (
            <div className="loading-notes">
              <span className="skeleton-line skeleton-title" />
              <span className="skeleton-line" />
              <span className="skeleton-line short" />
            </div>
          ) : filteredNotes.length ? (
            <div className="note-river">
              {filteredNotes.map((note) => (
                <motion.article
                  {...noteMotion}
                  layout={!reduceMotion}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className={`note-entry ${selected?.id === note.id ? "is-selected" : ""}`}
                  key={note.id}
                  onClick={() => selectNote(note.id)}
                >
                  <div className="note-entry-content">
                    <div className="note-entry-topline">
                      <span>{formatTime(note.updatedAt)}</span>
                      <div>
                        {note.pinned ? <PushPin size={15} weight="fill" aria-label="Pinned" /> : null}
                        {note.attachments.length ? <span className="file-chip"><Paperclip size={14} /> {note.attachments.length}</span> : null}
                      </div>
                    </div>
                    <h2>{noteTitle(note)}</h2>
                    {note.body ? <p>{note.body.replace(/\n+/g, " ")}</p> : null}
                    {note.sourceUrl ? (
                      <a href={note.sourceUrl} target="_blank" rel="noreferrer" className="note-link" onClick={(event) => event.stopPropagation()}>
                        <LinkSimple size={15} />
                        {new URL(note.sourceUrl).hostname.replace(/^www\./, "")}
                        <ArrowSquareOut size={14} />
                      </a>
                    ) : null}
                    {note.attachments.length ? <AttachmentStrip attachments={note.attachments} onOpen={openAttachment} /> : null}
                  </div>
                </motion.article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-mark"><NoteBlank size={28} /></span>
              <h2>Nothing here yet.</h2>
              <p>{search ? "Try another search term." : "Start by dropping a note, a link, or a file into Latch."}</p>
              {!search ? <button type="button" className="save-button" onClick={() => setComposerOpen(true)}><Plus size={18} /> New note</button> : null}
            </div>
          )}
        </section>
      </section>

      <aside className="inspection-panel" aria-label="Selected note">
        {selected ? (
          <NoteInspector
            key={selected.id}
            note={selected}
            onChange={updateNote}
            onPin={() => togglePinned(selected)}
            onArchive={() => archiveNote(selected)}
            onDelete={() => deleteNote(selected)}
            onDeleteAttachment={(attachment) => deleteAttachment(selected, attachment)}
            onOpenAttachment={openAttachment}
            onDownloadAttachment={downloadAttachment}
            onExportNotes={downloadNotes}
            onCopyText={copyText}
          />
        ) : (
          <div className="inspector-empty"><NoteBlank size={26} /><p>Select a note to inspect it.</p></div>
        )}
      </aside>

      {selected && mobileInspectorOpen ? (
        <div className="mobile-note-overlay" role="dialog" aria-modal="true" aria-label="Note details">
          <section className="mobile-note-sheet">
            <header className="mobile-note-header">
              <button className="mobile-note-back" type="button" onClick={() => setMobileInspectorOpen(false)} aria-label="Back to notes">
                <ArrowLeft size={20} weight="bold" />
              </button>
              <span>Note details</span>
              <span className="mobile-note-header-spacer" aria-hidden="true" />
            </header>
            <NoteInspector
              key={`mobile-${selected.id}`}
              note={selected}
              onChange={updateNote}
              onPin={() => togglePinned(selected)}
              onArchive={() => archiveNote(selected)}
              onDelete={() => deleteNote(selected)}
              onDeleteAttachment={(attachment) => deleteAttachment(selected, attachment)}
              onOpenAttachment={openAttachment}
              onDownloadAttachment={downloadAttachment}
              onExportNotes={downloadNotes}
              onCopyText={copyText}
            />
          </section>
        </div>
      ) : null}

      <AnimatePresence>
        {notice ? <motion.div className="toast" initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>{notice}</motion.div> : null}
      </AnimatePresence>

      <AnimatePresence>
        {preview ? <PreviewModal preview={preview} onClose={closePreview} onDownload={() => downloadAttachment(preview.attachment)} /> : null}
      </AnimatePresence>
    </main>
  );
}

function AttachmentStrip({ attachments, onOpen }: { attachments: AttachmentMeta[]; onOpen: (attachment: AttachmentMeta) => Promise<void> }) {
  return (
    <div className="attachment-strip">
      {attachments.slice(0, 3).map((attachment) => (
        <button type="button" key={attachment.id} onClick={(event) => { event.stopPropagation(); void onOpen(attachment); }}>
          {fileIcon(attachment.type, 16)}
          <span>{attachment.name}</span>
        </button>
      ))}
    </div>
  );
}

function NoteInspector({
  note,
  onChange,
  onPin,
  onArchive,
  onDelete,
  onDeleteAttachment,
  onOpenAttachment,
  onDownloadAttachment,
  onExportNotes,
  onCopyText,
}: {
  note: LatchNote;
  onChange: (note: LatchNote) => Promise<void>;
  onPin: () => Promise<void>;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
  onDeleteAttachment: (attachment: AttachmentMeta) => Promise<void>;
  onOpenAttachment: (attachment: AttachmentMeta) => Promise<void>;
  onDownloadAttachment: (attachment: AttachmentMeta) => Promise<void>;
  onExportNotes: () => void;
  onCopyText: (value: string, label: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: note.title, body: note.body, sourceUrl: note.sourceUrl ?? "" });

  async function saveEdits() {
    const sourceUrl = normaliseUrl(draft.sourceUrl);
    await onChange({ ...note, title: draft.title.trim() || "Untitled note", body: draft.body.trim(), sourceUrl, updatedAt: new Date().toISOString() });
    setEditing(false);
  }

  return (
    <div className="inspector-content">
      <div className="inspector-toolbar">
        <span>Inspect</span>
        <div>
          <button className={`mini-icon ${note.pinned ? "is-tinted" : ""}`} type="button" onClick={onPin} aria-label="Toggle pin"><PushPin size={17} weight={note.pinned ? "fill" : "regular"} /></button>
          <button className="mini-icon" type="button" onClick={onArchive} aria-label="Archive note"><Archive size={17} /></button>
          <button className="mini-icon danger" type="button" onClick={onDelete} aria-label="Delete note"><Trash size={17} /></button>
        </div>
      </div>

      {editing ? (
        <div className="edit-sheet">
          <label>Title<input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
          <label>Note<textarea value={draft.body} rows={10} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} /></label>
          <label>Link<input value={draft.sourceUrl} onChange={(event) => setDraft((current) => ({ ...current, sourceUrl: event.target.value }))} /></label>
          <div className="edit-actions"><button className="cancel-button" type="button" onClick={() => setEditing(false)}>Cancel</button><button className="save-button" type="button" onClick={saveEdits}><Check size={17} /> Save</button></div>
        </div>
      ) : (
        <>
          <div className="inspector-headline">
            <p>{formatTime(note.updatedAt)}</p>
            <h2>{noteTitle(note)}</h2>
            <div className="copy-actions">
              <button type="button" onClick={() => void onCopyText(note.title.trim() || noteTitle(note), "Title")}><Copy size={15} /> Copy title</button>
              <button type="button" onClick={() => void onCopyText(note.body, "Note")} disabled={!note.body.trim()}><Copy size={15} /> Copy note</button>
            </div>
            {note.body ? <div className="note-body-preview">{note.body.split("\n").map((line, index) => line ? <p key={`${line}-${index}`}>{line}</p> : <br key={`break-${index}`} />)}</div> : null}
            {note.sourceUrl ? <a href={note.sourceUrl} target="_blank" rel="noreferrer" className="inspector-link"><LinkSimple size={16} /> {new URL(note.sourceUrl).hostname.replace(/^www\./, "")}<ArrowSquareOut size={14} /></a> : null}
          </div>
          <button className="edit-button" type="button" onClick={() => setEditing(true)}>Edit note</button>
        </>
      )}

      <section className="attachment-section">
        <div className="section-line"><h3>Attachments</h3><span>{note.attachments.length}</span></div>
        {note.attachments.length ? (
          <div className="attachment-list">
            {note.attachments.map((attachment) => (
              <div className="attachment-row" key={attachment.id}>
                <button type="button" className="attachment-main" onClick={() => onOpenAttachment(attachment)}>
                  <span className="attachment-glyph">{fileIcon(attachment.type)}</span>
                  <span><strong>{attachment.name}</strong><small>{formatBytes(attachment.size)}</small></span>
                </button>
                <div className="attachment-actions">
                  <button type="button" onClick={() => onDownloadAttachment(attachment)} aria-label={`Download ${attachment.name}`}><DownloadSimple size={16} /></button>
                  <button type="button" onClick={() => onDeleteAttachment(attachment)} aria-label={`Remove ${attachment.name}`}><X size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="muted-copy">No attachments on this note.</p>}
      </section>

      <div className="inspector-footer">
        <span>Created {new Date(note.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        <button type="button" onClick={onExportNotes}><FileArrowUp size={16} /> Export notes</button>
      </div>
    </div>
  );
}

function PreviewModal({ preview, onClose, onDownload }: { preview: Preview; onClose: () => void; onDownload: () => void }) {
  const isImage = preview.attachment.type.startsWith("image/");
  const isPdf = preview.attachment.type.includes("pdf");
  const isCsv = Boolean(preview.csvRows);
  const isText = preview.attachment.type.startsWith("text/") || preview.attachment.type.includes("json");
  const [text, setText] = useState("");

  useEffect(() => {
    if (!isText || isCsv) return;
    fetch(preview.url).then((response) => response.text()).then(setText).catch(() => setText("Preview unavailable."));
  }, [isCsv, isText, preview.url]);

  return (
    <motion.div className="preview-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
      <motion.section className="preview-dialog" initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }} onMouseDown={(event) => event.stopPropagation()}>
        <header><div>{fileIcon(preview.attachment.type, 20)}<span>{preview.attachment.name}</span></div><div><button type="button" className="mini-icon" onClick={onDownload} aria-label="Download attachment"><DownloadSimple size={18} /></button><button type="button" className="mini-icon" onClick={onClose} aria-label="Close preview"><X size={18} /></button></div></header>
        <div className="preview-content">
          {/* Object URLs must bypass Next's remote image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {isImage ? <img src={preview.url} alt={preview.attachment.name} /> : null}
          {isPdf ? <iframe src={preview.url} title={preview.attachment.name} /> : null}
          {isCsv ? <div className="csv-preview"><table><tbody>{preview.csvRows?.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div> : null}
          {isText && !isCsv ? <pre>{text || "Loading preview..."}</pre> : null}
        </div>
      </motion.section>
    </motion.div>
  );
}
