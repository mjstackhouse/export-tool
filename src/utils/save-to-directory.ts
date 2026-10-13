// The folder picker is part of the File System Access API, which is currently only available in Chromium browsers (Chrome, Edge),
// so it isn't included in TypeScript's DOM types
type DirectoryPicker = (options?: { id?: string, mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;

export function canPickDirectory() {
  return typeof (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker === 'function';
}

// Resolves to null if the user closes the picker without choosing a folder
export async function pickDirectory() {
  try {
    return await (window as unknown as { showDirectoryPicker: DirectoryPicker }).showDirectoryPicker({ id: 'content-export', mode: 'readwrite' });
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
}

export async function writeFileToDirectory(directory: FileSystemDirectoryHandle, path: Array<string>, contents: BufferSource | string) {
  let currentDirectory = directory;

  for (const folderName of path.slice(0, -1)) {
    currentDirectory = await currentDirectory.getDirectoryHandle(folderName, { create: true });
  }

  const fileHandle = await currentDirectory.getFileHandle(path[path.length - 1], { create: true });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(contents);
    await writable.close();
  }
  catch (error) {
    await writable.abort().catch(() => {});
    throw error;
  }
}

// Gives the browser a chance to repaint (e.g. the loading text) before long-running synchronous work.
// The timeout covers background tabs, where requestAnimationFrame doesn't fire.
export function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 50);

    requestAnimationFrame(() => {
      clearTimeout(timeout);
      setTimeout(resolve, 0);
    });
  });
}
