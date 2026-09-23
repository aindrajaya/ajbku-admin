import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

export async function getPdfPageCount(data: Uint8Array) {
  const pdf = await getDocument({ data }).promise;
  return pdf.numPages;
}

export async function renderPdfToCanvas(canvas: HTMLCanvasElement, data: Uint8Array, scale: number, pageNumber = 1, rotation = 0) {
  const pdf = await getDocument({ data }).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale, rotation });
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas context unavailable');
  }

  canvas.height = viewport.height;
  canvas.width = viewport.width;
  await page.render({ canvasContext: context, viewport, canvas }).promise;
}
