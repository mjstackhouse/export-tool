import JSZip from 'jszip';

export type ExportFile = {
  path: Array<string>,
  contents: Uint8Array
}

// Browsers don't expose their memory limits (outside of Chromium), so this is a conservative estimate of how much finished file data
// can be held at once. Once the next language would go over it, the files collected so far are downloaded as a numbered ZIP part.
export const EXPORT_PART_BYTE_BUDGET = 400 * 1024 * 1024;

export function getTotalBytes(files: Array<ExportFile>) {
  return files.reduce((total, file) => total + file.contents.byteLength, 0);
}

export async function createZipBlob(files: Array<ExportFile>) {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path.join('/'), file.contents);
  }

  return await zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');

  downloadLink.href = url;
  downloadLink.download = fileName;
  downloadLink.click();

  // Release the file from memory once the download has had time to start (some browsers read the URL asynchronously)
  setTimeout(() => URL.revokeObjectURL(url), 40000);
}
