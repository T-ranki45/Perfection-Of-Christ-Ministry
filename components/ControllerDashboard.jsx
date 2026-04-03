import { useEffect, useMemo, useState } from "react";

const TABS = ["songs", "scripture", "media", "themes"];
const SURFACES = [
  "bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.24),transparent_34%),linear-gradient(180deg,#18181b_0%,#020617_100%)]",
  "bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.22),transparent_34%),linear-gradient(180deg,#111827_0%,#09090b_100%)]",
  "bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.2),transparent_34%),linear-gradient(180deg,#1f2937_0%,#0a0a0a_100%)]",
  "bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_34%),linear-gradient(180deg,#0f172a_0%,#020617_100%)]",
];
const TYPE_PILLS = {
  song: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  scripture: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  video: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  media: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  theme: "border-sky-500/30 bg-sky-500/10 text-sky-200",
};

function getId(item, fallback) {
  return item?._id || item?.id || item?.key || item?.title || fallback;
}

function slideKey(itemId, index) {
  return `${itemId}-${index}`;
}

function bgStyle(url) {
  return url
    ? {
        backgroundImage: `linear-gradient(180deg,rgba(9,9,11,0.08) 0%,rgba(9,9,11,0.62) 100%), url("${url}")`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }
    : undefined;
}

function normalizeSlides(slides = [], seed = 0) {
  return slides.map((slide, index) => ({
    id: getId(slide, `slide-${index}`),
    label: slide?.label || `Slide ${index + 1}`,
    lyrics: String(slide?.lyrics || slide?.text || ""),
    thumbnail: slide?.thumbnail || slide?.backgroundImage || slide?.image || "",
    backgroundType: slide?.backgroundType || "",
    surface: SURFACES[(seed + index) % SURFACES.length],
  }));
}

function normalizeSchedule(scheduleItems = [], songs = []) {
  const source = scheduleItems.length
    ? scheduleItems
    : songs.map((song, index) => ({
        id: getId(song, `song-${index}`),
        type: "song",
        title: song?.title || `Song ${index + 1}`,
        subtitle: song?.artist || "Unknown artist",
        thumbnail: song?.thumbnail || song?.coverImage || song?.image || "",
        slides: song?.slides || [],
      }));

  return source.map((item, index) => ({
    id: getId(item, `item-${index}`),
    type: String(item?.type || "song").toLowerCase(),
    title: item?.title || item?.name || `Item ${index + 1}`,
    subtitle: item?.subtitle || item?.artist || item?.reference || "",
    thumbnail: item?.thumbnail || item?.coverImage || item?.image || "",
    slides: normalizeSlides(item?.slides || [], index * 5),
    surface: SURFACES[index % SURFACES.length],
  }));
}

function reorder(items, draggedId, targetId) {
  const from = items.findIndex((item) => item.id === draggedId);
  const to = items.findIndex((item) => item.id === targetId);
  if (from === -1 || to === -1 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function rowItem(category, item, index) {
  const format = (value) => {
    if (!value) return "Ready";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  };

  if (category === "songs") {
    return {
      id: getId(item, `song-${index}`),
      category,
      source: item,
      title: item?.title || `Song ${index + 1}`,
      subtitle: item?.artist || "Unknown artist",
      author: item?.artist || "Unknown artist",
      type: "Song",
      meta: `${(item?.slides || []).length} slide${(item?.slides || []).length === 1 ? "" : "s"}`,
      updated: format(item?.updatedAt || item?.modifiedAt),
    };
  }

  if (category === "scripture") {
    return {
      id: getId(item, `scripture-${index}`),
      category,
      source: item,
      title: item?.reference || item?.title || item?.name || `Scripture ${index + 1}`,
      subtitle: item?.translation || item?.subtitle || "Prepared passage",
      author: item?.translation || item?.version || "Scripture",
      type: "Scripture",
      meta: item?.range || item?.book || `${(item?.slides || []).length || 0} slides`,
      updated: format(item?.updatedAt || item?.modifiedAt),
    };
  }

  if (category === "media") {
    return {
      id: getId(item, `media-${index}`),
      category,
      source: item,
      title: item?.title || item?.name || `Media ${index + 1}`,
      subtitle: item?.duration || item?.subtitle || "Media asset",
      author: item?.mediaType || item?.type || "Media",
      type: item?.mediaType || item?.type || "Media",
      meta: item?.fileName || item?.source || "Ready to load",
      updated: format(item?.updatedAt || item?.modifiedAt),
    };
  }

  return {
    id: getId(item, `theme-${index}`),
    category,
    source: item,
    title: item?.title || item?.name || `Theme ${index + 1}`,
    subtitle: item?.palette || item?.subtitle || "Visual theme",
    author: item?.font || item?.accent || "Theme",
    type: "Theme",
    meta: item?.accent || item?.font || "Presentation style",
    updated: format(item?.updatedAt || item?.modifiedAt),
  };
}

function createScheduleEntryFromRow(row, scheduleLength) {
  const source = row?.source || {};
  const baseId = getId(source, row?.id || `library-${scheduleLength}`);
  const instanceId = `${row.category}-${baseId}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  return normalizeSchedule(
    [
      {
        id: instanceId,
        type:
          row.category === "songs"
            ? "song"
            : row.category === "scripture"
              ? "scripture"
              : row.category === "media"
                ? String(source?.mediaType || source?.type || "media").toLowerCase()
                : "theme",
        title: source?.title || source?.name || row.title || "New Item",
        subtitle:
          source?.artist ||
          source?.subtitle ||
          source?.reference ||
          source?.translation ||
          row.subtitle ||
          "",
        thumbnail: source?.thumbnail || source?.coverImage || source?.image || "",
        slides: source?.slides || [],
      },
    ],
    [],
  )[0];
}

export default function ControllerDashboard({
  songs = [],
  scheduleItems = [],
  scriptureItems = [],
  mediaItems = [],
  themeItems = [],
  socket,
  defaultBackgroundType = "song",
  onSlidePushed,
  onScheduleReorder,
  onClearText,
}) {
  const [schedule, setSchedule] = useState(() => normalizeSchedule(scheduleItems, songs));
  const [activeSongId, setActiveSongId] = useState(
    () => normalizeSchedule(scheduleItems, songs)[0]?.id || "",
  );
  const [selectedSlideKey, setSelectedSlideKey] = useState("");
  const [draggedId, setDraggedId] = useState("");
  const [dragOverId, setDragOverId] = useState("");
  const [activeTab, setActiveTab] = useState("songs");
  const [searchTerm, setSearchTerm] = useState("");
  const [isConnected, setIsConnected] = useState(Boolean(socket?.connected));
  const [liveSlideKey, setLiveSlideKey] = useState("");
  const [liveMonitor, setLiveMonitor] = useState({
    mode: "clear",
    title: "",
    label: "",
    text: "",
    thumbnail: "",
  });

  useEffect(() => {
    const next = normalizeSchedule(scheduleItems, songs);
    setSchedule(next);
    setActiveSongId((current) =>
      next.some((item) => item.id === current) ? current : next[0]?.id || "",
    );
  }, [scheduleItems, songs]);

  const activeSong = schedule.find((item) => item.id === activeSongId) || null;
  const slides = activeSong?.slides || [];

  useEffect(() => {
    if (!activeSong || !slides.length) {
      setSelectedSlideKey("");
      return;
    }

    const first = slideKey(activeSong.id, 0);
    const exists = slides.some(
      (_, index) => slideKey(activeSong.id, index) === selectedSlideKey,
    );
    if (!exists) setSelectedSlideKey(first);
  }, [activeSong, selectedSlideKey, slides]);

  const selectedSlideIndex = activeSong
    ? slides.findIndex((_, index) => slideKey(activeSong.id, index) === selectedSlideKey)
    : -1;

  useEffect(() => {
    if (!socket?.on || !socket?.off) {
      setIsConnected(false);
      return undefined;
    }

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleUpdate = (payload = {}) => {
      setLiveMonitor({
        mode: "live",
        title: String(payload.songTitle || payload.title || ""),
        label: String(payload.label || ""),
        text: String(payload.slideText || payload.lyrics || payload.text || ""),
        thumbnail: String(payload.thumbnail || ""),
      });
      if (payload.songId !== undefined && payload.slideIndex !== undefined) {
        setLiveSlideKey(`${payload.songId}-${payload.slideIndex}`);
      }
    };
    const handleClear = () => {
      setLiveMonitor((current) => ({
        ...current,
        mode: "clear",
        label: "",
        text: "",
      }));
      setLiveSlideKey("");
    };

    setIsConnected(Boolean(socket.connected));
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("update_projector", handleUpdate);
    socket.on("clear_screen", handleClear);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("update_projector", handleUpdate);
      socket.off("clear_screen", handleClear);
    };
  }, [socket]);

  const libraryRows = useMemo(() => {
    const mapped = {
      songs: songs.map((item, index) => rowItem("songs", item, index)),
      scripture: scriptureItems.map((item, index) => rowItem("scripture", item, index)),
      media: mediaItems.map((item, index) => rowItem("media", item, index)),
      themes: themeItems.map((item, index) => rowItem("themes", item, index)),
    };
    const rows = mapped[activeTab] || [];
    const query = searchTerm.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.title, row.subtitle, row.author, row.type, row.meta]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [activeTab, mediaItems, scriptureItems, searchTerm, songs, themeItems]);

  function updateSchedule(next) {
    setSchedule(next);
    if (typeof onScheduleReorder === "function") onScheduleReorder(next);
  }

  function addLibraryItemToSchedule(row) {
    const nextEntry = createScheduleEntryFromRow(row, schedule.length);
    updateSchedule([...schedule, nextEntry]);
    if (!activeSongId) setActiveSongId(nextEntry.id);
  }

  function goLive(slide, slideIndex) {
    if (!activeSong || !slide || slideIndex < 0) return;
    const payload = {
      songId: activeSong.id,
      songTitle: activeSong.title,
      title: activeSong.title,
      itemType: activeSong.type,
      label: slide.label || `Slide ${slideIndex + 1}`,
      lyrics: slide.lyrics || "",
      slideText: slide.lyrics || "",
      slideIndex,
      backgroundType: slide.backgroundType || defaultBackgroundType,
      thumbnail: slide.thumbnail || activeSong.thumbnail || "",
    };

    if (socket?.emit) socket.emit("push_live_slide", payload);

    setSelectedSlideKey(slideKey(activeSong.id, slideIndex));
    setLiveSlideKey(slideKey(activeSong.id, slideIndex));
    setLiveMonitor({
      mode: "live",
      title: activeSong.title,
      label: payload.label,
      text: payload.slideText,
      thumbnail: payload.thumbnail,
    });

    if (typeof onSlidePushed === "function") onSlidePushed(payload);
  }

  function clearText() {
    if (socket?.emit) socket.emit("clear_screen");
    setLiveMonitor((current) => ({
      ...current,
      mode: "clear",
      label: "",
      text: "",
    }));
    setLiveSlideKey("");
    if (typeof onClearText === "function") onClearText();
  }

  function blackout() {
    setLiveMonitor({
      mode: "blackout",
      title: "",
      label: "",
      text: "",
      thumbnail: "",
    });
  }

  return (
    <div className="h-screen w-full bg-zinc-950 text-zinc-300 flex flex-col overflow-hidden">
      <div className="grid grid-cols-12 h-[60%] border-b border-zinc-800">
        <div className="col-span-2 border-r border-zinc-800 flex flex-col min-h-0">
          <div className="p-2 bg-zinc-900 text-xs font-bold uppercase tracking-wider">
            Schedule
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {schedule.length ? (
              schedule.map((item, index) => {
                const active = item.id === activeSongId;
                const pill = TYPE_PILLS[item.type] || TYPE_PILLS.song;
                return (
                  <button
                    key={item.id}
                    type="button"
                    draggable
                    onClick={() => setActiveSongId(item.id)}
                    onDragStart={() => {
                      setDraggedId(item.id);
                      setDragOverId(item.id);
                    }}
                    onDragEnter={() => setDragOverId(item.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (!draggedId) return;
                      updateSchedule(reorder(schedule, draggedId, item.id));
                      setDraggedId("");
                      setDragOverId("");
                    }}
                    onDragEnd={() => {
                      setDraggedId("");
                      setDragOverId("");
                    }}
                    className={`w-full rounded border p-2 text-left transition ${
                      active
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-zinc-800 bg-zinc-900/80 hover:border-zinc-700"
                    } ${dragOverId === item.id && draggedId !== item.id ? "ring-2 ring-blue-500/30" : ""}`}
                  >
                    <div className="flex gap-2">
                      <div
                        className={`aspect-video w-20 shrink-0 overflow-hidden rounded border border-zinc-800 ${item.surface}`}
                        style={bgStyle(item.thumbnail || item.slides[0]?.thumbnail)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${pill}`}
                          >
                            {item.type}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs font-semibold text-zinc-100">
                          {item.title}
                        </p>
                        <p className="truncate text-[10px] text-zinc-500">
                          {item.subtitle || "Prepared item"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded border border-dashed border-zinc-800 bg-zinc-900/80 p-3 text-[11px] text-zinc-500">
                No schedule items yet.
              </div>
            )}
          </div>
        </div>

        <div className="col-span-7 border-r border-zinc-800 flex flex-col min-h-0">
          <div className="p-2 bg-zinc-900 text-xs font-bold uppercase tracking-wider">
            Live Deck
          </div>
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 gap-4 content-start">
            {slides.length ? (
              slides.map((slide, index) => {
                const key = slideKey(activeSong.id, index);
                const selected = selectedSlideKey === key;
                const live = liveSlideKey === key;
                return (
                  <button
                    key={slide.id || key}
                    type="button"
                    onClick={() => goLive(slide, index)}
                    className={`aspect-video rounded border-2 cursor-pointer overflow-hidden text-left transition ${
                      live
                        ? "border-[#ef4444]"
                        : selected
                          ? "border-[#3b82f6]"
                          : "border-transparent hover:border-zinc-500"
                    }`}
                  >
                    <div
                      className={`relative h-full w-full ${slide.surface}`}
                      style={bgStyle(slide.thumbnail || activeSong.thumbnail)}
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/75" />
                      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-3 py-2">
                        <span className="rounded bg-black/45 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-100">
                          {slide.label}
                        </span>
                        {live ? (
                          <span className="rounded bg-red-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                            Live
                          </span>
                        ) : selected ? (
                          <span className="rounded bg-blue-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                            Selected
                          </span>
                        ) : null}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-3">
                        <p className="text-center text-sm font-semibold text-white">
                          {slide.label}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="col-span-3 rounded border border-dashed border-zinc-800 bg-zinc-900/80 p-6 text-center text-sm text-zinc-500">
                Select a schedule item to load slide previews.
              </div>
            )}
          </div>
        </div>

        <div className="col-span-3 flex flex-col bg-black/20 min-h-0">
          <div className="p-2 bg-zinc-900 text-xs font-bold uppercase tracking-wider">
            Live Output
          </div>
          <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
            <div
              className={`aspect-video border border-zinc-700 shadow-2xl flex items-center justify-center text-center p-4 ${
                liveMonitor.mode === "blackout" ? "bg-black" : "bg-black"
              }`}
              style={bgStyle(liveMonitor.thumbnail)}
            >
              <div className="flex h-full w-full items-center justify-center bg-black/35">
                {liveMonitor.text ? (
                  <span className="text-lg font-bold text-white">
                    {liveMonitor.text}
                  </span>
                ) : (
                  <span className="text-sm font-bold uppercase tracking-wider text-zinc-500">
                    {isConnected ? "Cleared" : "Offline"}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-auto space-y-2">
              <button
                type="button"
                onClick={blackout}
                className="w-full py-2 bg-red-900/20 text-red-500 border border-red-900 hover:bg-red-900/40 rounded transition-all font-bold"
              >
                BLACKOUT
              </button>
              <button
                type="button"
                onClick={clearText}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded transition-all"
              >
                CLEAR TEXT
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="h-[40%] flex flex-col min-h-0">
        <div className="flex bg-zinc-900 border-b border-zinc-800">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 text-sm capitalize ${
                activeTab === tab
                  ? "bg-zinc-800 border-t-2 border-blue-500 text-white"
                  : "hover:bg-zinc-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search Library..."
            className="w-full mb-4 bg-zinc-800 border border-zinc-700 p-2 rounded text-sm focus:outline-none focus:border-blue-500"
          />
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="pb-2">Title</th>
                <th className="pb-2">Author</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {libraryRows.length ? (
                libraryRows.map((row) => (
                  <tr
                    key={`${row.category}-${row.id}`}
                    className="hover:bg-blue-900/10 cursor-pointer"
                    onClick={() => addLibraryItemToSchedule(row)}
                  >
                    <td className="py-2 pr-4 text-zinc-100">{row.title}</td>
                    <td className="py-2 text-zinc-400">{row.author}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-6 text-zinc-500" colSpan={2}>
                    No items found in this library view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
