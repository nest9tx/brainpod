'use client';

import { useState } from 'react';

type Props = {
  text: string;
  filename: string;
  label?: string;
};

export default function DownloadMarkdownButton({
  text,
  filename,
  label = 'Download Markdown',
}: Props) {
  const [done, setDone] = useState(false);

  function onDownload() {
    try {
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.md') ? filename : `${filename}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
    } catch {
      window.prompt('Copy this Markdown:', text);
    }
  }

  return (
    <button
      type="button"
      onClick={onDownload}
      className="text-xs text-calm-accent underline hover:text-calm-text"
    >
      {done ? 'Downloaded' : label}
    </button>
  );
}
