import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const DEFAULT_TRANSITION_MS = 300;

function getBackgroundClasses(backgroundType, transparentBackground) {
  if (transparentBackground) {
    return "bg-transparent";
  }

  switch (String(backgroundType || "").trim().toLowerCase()) {
    case "blue-waves":
      return "bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.26),transparent_34%),linear-gradient(180deg,#08111f_0%,#020617_100%)]";
    case "warm":
      return "bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.22),transparent_34%),linear-gradient(180deg,#1a1206_0%,#05070c_100%)]";
    case "solid":
      return "bg-slate-950";
    default:
      return "bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.12),transparent_34%),linear-gradient(180deg,#0f172a_0%,#020617_100%)]";
  }
}

function normalizeProjectorPayload(payload = {}) {
  return {
    slideText: String(payload.slideText || payload.lyrics || payload.text || ""),
    backgroundType: String(payload.backgroundType || "default"),
  };
}

export default function ProjectorScreen({
  socket: providedSocket,
  socketUrl =
    typeof window !== "undefined" ? window.location.origin : undefined,
  transparentBackground = true,
  transitionMs = DEFAULT_TRANSITION_MS,
  fontFamily = '"Inter", "Montserrat", "Segoe UI", sans-serif',
}) {
  const [currentSlide, setCurrentSlide] = useState({
    slideText: "",
    backgroundType: "default",
  });
  const [previousSlide, setPreviousSlide] = useState(null);
  const [transitionActive, setTransitionActive] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const currentSlideRef = useRef(currentSlide);
  const isVisibleRef = useRef(isVisible);
  const transitionTimeoutRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    currentSlideRef.current = currentSlide;
  }, [currentSlide]);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  function clearTransitionTimers() {
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  function crossFadeTo(nextSlide) {
    clearTransitionTimers();

    const activeSlide = currentSlideRef.current;
    const activeVisibility = isVisibleRef.current;
    const hasCurrentContent = Boolean(activeSlide.slideText && activeVisibility);
    const isSameSlide =
      activeSlide.slideText === nextSlide.slideText &&
      activeSlide.backgroundType === nextSlide.backgroundType;

    if (!hasCurrentContent || isSameSlide) {
      setPreviousSlide(null);
      setCurrentSlide(nextSlide);
      setTransitionActive(false);
      setIsVisible(Boolean(nextSlide.slideText));
      return;
    }

    setPreviousSlide(activeSlide);
    setCurrentSlide(nextSlide);
    setIsVisible(Boolean(nextSlide.slideText));
    setTransitionActive(false);

    animationFrameRef.current = window.requestAnimationFrame(() => {
      setTransitionActive(true);
      transitionTimeoutRef.current = window.setTimeout(() => {
        setPreviousSlide(null);
        setTransitionActive(false);
      }, transitionMs);
    });
  }

  useEffect(() => {
    const activeSocket =
      providedSocket ||
      io(socketUrl, {
        transports: ["websocket", "polling"],
        withCredentials: true,
      });

    const handleProjectorUpdate = (payload = {}) => {
      const nextSlide = normalizeProjectorPayload(payload);
      crossFadeTo(nextSlide);
    };

    const handleClearScreen = () => {
      clearTransitionTimers();
      setPreviousSlide(null);
      setTransitionActive(false);
      setIsVisible(false);
    };

    activeSocket.on("update_projector", handleProjectorUpdate);
    activeSocket.on("clear_screen", handleClearScreen);

    return () => {
      clearTransitionTimers();
      activeSocket.off("update_projector", handleProjectorUpdate);
      activeSocket.off("clear_screen", handleClearScreen);

      if (!providedSocket) {
        activeSocket.disconnect();
      }
    };
  }, [providedSocket, socketUrl, transitionMs]);

  const backgroundClasses = useMemo(
    () =>
      getBackgroundClasses(currentSlide.backgroundType, transparentBackground),
    [currentSlide.backgroundType, transparentBackground],
  );

  const lyricLayerClassName =
    "absolute inset-0 flex items-center justify-center text-center font-black tracking-tight text-white drop-shadow-lg";

  return (
    <div
      className={`fixed inset-0 m-0 h-screen w-screen overflow-hidden ${backgroundClasses}`}
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        backgroundColor: transparentBackground ? "transparent" : undefined,
      }}
    >
      <div className="flex h-full w-full items-center justify-center">
        <div className="relative flex h-full w-[90vw] max-w-[90vw] items-center justify-center overflow-hidden">
          {previousSlide ? (
            <div
              className={`${lyricLayerClassName} ${
                transitionActive ? "opacity-0" : "opacity-100"
              }`}
              style={{
                transition: `opacity ${transitionMs}ms ease`,
                fontFamily,
                fontSize: "clamp(2.2rem, 5.2vw, 6rem)",
                lineHeight: 1.14,
                textShadow:
                  "0 8px 28px rgba(0,0,0,0.28), 0 2px 10px rgba(0,0,0,0.42)",
                whiteSpace: "pre-line",
              }}
            >
              <div className="mx-auto w-full max-w-full break-words">
                {previousSlide.slideText}
              </div>
            </div>
          ) : null}

          <div
            aria-live="polite"
            className={`${lyricLayerClassName} ${
              isVisible
                ? previousSlide
                  ? transitionActive
                    ? "opacity-100"
                    : "opacity-0"
                  : "opacity-100"
                : "opacity-0"
            }`}
            style={{
              transition: `opacity ${transitionMs}ms ease`,
              fontFamily,
              fontSize: "clamp(2.2rem, 5.2vw, 6rem)",
              lineHeight: 1.14,
              textShadow:
                "0 8px 28px rgba(0,0,0,0.28), 0 2px 10px rgba(0,0,0,0.42)",
              whiteSpace: "pre-line",
            }}
          >
            <div className="mx-auto w-full max-w-full break-words">
              {currentSlide.slideText || "\u00A0"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
