export function saveChartFile(document: Document, blob: Blob, filename: string): void {
  const win = document.defaultView!;
  const link = document.createElement('a');
  const url = win.URL.createObjectURL(blob);
  try {
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
  }
}
