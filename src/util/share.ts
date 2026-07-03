import { toBlob, toPng } from "html-to-image";

export async function downloadElementPng(element: HTMLElement, fileName: string): Promise<void> {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#0B0E11",
  });
  const link = document.createElement("a");
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}

export async function copyElementPng(element: HTMLElement): Promise<"copied" | "downloaded"> {
  const blob = await toBlob(element, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#0B0E11",
  });
  if (!blob) throw new Error("Could not render image.");

  if ("ClipboardItem" in window && navigator.clipboard?.write) {
    const item = new ClipboardItem({ "image/png": blob });
    await navigator.clipboard.write([item]);
    return "copied";
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `binunce-trade-${Date.now()}.png`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}

export async function shareElementPng(
  element: HTMLElement,
  text: string,
): Promise<"shared" | "downloaded" | "unsupported"> {
  const blob = await toBlob(element, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#0B0E11",
  });
  if (!blob) return "unsupported";

  const file = new File([blob], `binunce-trade-${Date.now()}.png`, { type: "image/png" });
  const canShare = navigator.canShare?.({ files: [file] });
  if (navigator.share && canShare) {
    await navigator.share({
      title: "Binunce simulated trade",
      text,
      files: [file],
    });
    return "shared";
  }

  await downloadElementPng(element, file.name);
  return "downloaded";
}

export function openXIntent(text: string): void {
  const url = new URL("https://twitter.com/intent/tweet");
  url.searchParams.set("text", text);
  window.open(url.toString(), "_blank", "noopener,noreferrer");
}
