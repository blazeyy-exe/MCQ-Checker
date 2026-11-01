import { useEffect, useState } from "react";
import { loadOpenCV } from "../vision/opencvLoader";

export function useOpenCV() {
  const [cv, setCv] = useState<OpenCV | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadOpenCV().then((runtime) => {
      if (cancelled) return;
      setCv(runtime);
      setStatus(runtime ? "ready" : "unavailable");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { cv, status };
}
