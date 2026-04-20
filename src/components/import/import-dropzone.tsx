"use client";

import { useId, useRef, useState } from "react";

type ImportDropzoneProps = {
  title: string;
  description: string;
  actionLabel: string;
  busyLabel: string;
  actionTestId?: string;
  disabled?: boolean;
  onSubmit(files: File[]): Promise<void>;
};

export function ImportDropzone({
  title,
  description,
  actionLabel,
  busyLabel,
  actionTestId,
  disabled = false,
  onSubmit,
}: ImportDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (files.length === 0 || disabled || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(files);
      setFiles([]);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            {title}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <button
          type="button"
          data-testid={actionTestId}
          disabled={disabled || isSubmitting || files.length === 0}
          onClick={handleSubmit}
          className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-900 disabled:text-slate-300"
        >
          {isSubmitting ? busyLabel : actionLabel}
        </button>
      </div>

      <label
        htmlFor={inputId}
        className="mt-4 flex cursor-pointer flex-col rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4 text-sm text-slate-300 transition hover:border-slate-600"
      >
        <span className="font-medium text-slate-100">PDF, DOCX, Markdown, TXT</span>
        <span className="mt-1 text-xs text-slate-500">Click to select multiple files.</span>
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept=".txt,.md,.pdf,.docx"
        className="sr-only"
        onChange={(event) => {
          setFiles(Array.from(event.target.files ?? []));
        }}
      />

      {files.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {files.map((file) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-100">{file.name}</span>
                <span className="text-xs text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
