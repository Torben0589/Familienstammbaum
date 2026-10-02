"use client";

export function Modal({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card w-full max-w-lg max-h-[85vh] overflow-y-auto p-7">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full w-8 h-8 flex items-center justify-center text-ink-500 hover:bg-ink-900/5"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
