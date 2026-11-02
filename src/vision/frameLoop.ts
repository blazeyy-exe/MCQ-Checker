export type FrameCallback = (timestamp: number) => void;
export type FrameScheduler = (callback: FrameCallback) => number;

export function startFrameLoop(
  schedule: FrameScheduler,
  cancel: (handle: number) => void,
  callback: FrameCallback,
): () => void {
  let active = true;
  let handle = 0;
  const tick: FrameCallback = (timestamp) => {
    if (!active) return;
    callback(timestamp);
    if (active) handle = schedule(tick);
  };
  handle = schedule(tick);
  return () => {
    if (!active) return;
    active = false;
    cancel(handle);
  };
}
