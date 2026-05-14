"use client";

import { createContext, useContext, useMemo, useState } from "react";

type ToastOptions = {
  title?: string;
};

type ToastMessage = {
  id: number;
  title: string;
  message: string;
};

type ToastContextValue = {
  showToast: (message: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast(message, options) {
        const id = Date.now();
        setToasts((current) => [
          ...current.slice(-2),
          {
            id,
            title: options?.title ?? "Something needs attention",
            message,
          },
        ]);
        window.setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== id));
        }, 6000);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed inset-x-4 top-4 z-50 mx-auto grid max-w-xl gap-2" aria-live="assertive">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className="flex items-start justify-between gap-4 rounded-lg border border-rose-200 bg-white p-4 text-sm text-rose-950 shadow-lg"
          >
            <div>
              <p className="font-semibold">{toast.title}</p>
              <p className="mt-1 leading-6">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
              className="rounded-md px-2 py-1 text-sm font-semibold text-rose-800 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2"
              aria-label="Dismiss notification"
            >
              Close
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
