export const buildDashboardShareUrl = (type, id, language = 'en') => {
  const url = new URL(`/share/${type}/${encodeURIComponent(id)}`, window.location.origin);
  if (language) url.searchParams.set('language', language.substring(0, 2));
  return url.toString();
};

export const copyTextToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
};
