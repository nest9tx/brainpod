'use client';

import { useState } from 'react';

type CopyStudyButtonProps = {
  text: string;
  label?: string;
};

export default function CopyStudyButton({ text, label = 'Copy study' }: CopyStudyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this study:', text);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="text-xs text-calm-accent underline hover:text-calm-text"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}
