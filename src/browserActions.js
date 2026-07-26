export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(String(text));
    return true;
  } catch {
    return false;
  }
};

export const copyCanvasImage = async (canvas) => {
  if (!canvas || !navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
    return false;
  }

  try {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return false;
    await navigator.clipboard.write([
      new window.ClipboardItem({ 'image/png': blob }),
    ]);
    return true;
  } catch {
    return false;
  }
};

export const downloadUrl = (url, fileName) => {
  if (!url) return false;
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
};

export const downloadBlob = (blob, fileName) => {
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  try {
    return downloadUrl(url, fileName);
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const shareUrl = async ({
  title,
  url = window.location.href,
}) => {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch {}
  }
  return (await copyText(url)) ? 'copied' : 'failed';
};
