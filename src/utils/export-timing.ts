// Timing details are only logged to the browser console, to help diagnose slow exports (e.g. by asking a user for their console output)
const LOG_PREFIX = '[Export timing]';

export function formatDuration(ms: number) {
  const totalSeconds = ms / 1000;

  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);

  return hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
}

export function logExportTiming(message: string) {
  console.info(`${LOG_PREFIX} ${new Date().toLocaleTimeString()}: ${message}`);
}

// Browsers slow down background tabs, so tab visibility changes are logged alongside the timings. Returns a function that stops logging.
export function logTabVisibilityChanges() {
  const handleVisibilityChange = () => {
    logExportTiming(document.visibilityState === 'hidden' ? 'Tab moved to the background' : 'Tab back in the foreground');
  };

  if (document.visibilityState === 'hidden') handleVisibilityChange();
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}
