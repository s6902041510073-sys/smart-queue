'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onCancel]);

  if (!mounted || !visible) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-sm transition-all duration-300 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
      >
        <div className="glass-strong rounded-3xl shadow-2xl overflow-hidden">
          {/* Header gradient bar */}
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          <div className="p-6">
            {/* Icon */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-3xl mb-4 shadow-inner">
              ⚠️
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-gray-800 text-center mb-2">
              {title}
            </h3>

            {/* Message */}
            <p className="text-gray-500 text-center text-sm leading-relaxed mb-6">
              {message}
            </p>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold shadow-lg shadow-red-200/50 hover:shadow-xl hover:shadow-red-300/50 hover:-translate-y-0.5 transition-all duration-200"
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
