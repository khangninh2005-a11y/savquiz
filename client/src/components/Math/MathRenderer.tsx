import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    MathJax?: any;
  }
}

interface MathRendererProps {
  content: string;
  isBase64?: boolean;
  className?: string;
}

export const safeDecodeBase64 = (str: string): string => {
  if (!str || typeof str !== 'string') return '';
  const trimmed = str.trim();
  // If it contains HTML tags, spaces, newlines, or is too short, it is NOT base64 encoded data
  if (trimmed.includes('<') || trimmed.includes(' ') || trimmed.includes('\n') || trimmed.length < 16) {
    return str;
  }
  // Check if string matches base64 pattern and valid length multiple of 4
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) || trimmed.length % 4 !== 0) {
    return str;
  }
  try {
    const decoded = decodeURIComponent(
      atob(trimmed)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    // Sanity check: decoded string must be valid printable text with no control characters
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(decoded)) {
      return str;
    }
    return decoded;
  } catch {
    return str;
  }
};

export const MathRenderer: React.FC<MathRendererProps> = ({
  content,
  isBase64 = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rawHtml = isBase64 ? safeDecodeBase64(content) : content;

  useEffect(() => {
    // Ensure MathJax 3 is loaded if not already
    if (!window.MathJax) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
      script.async = true;
      document.head.appendChild(script);
    }

    // Typeset MathJax after DOM render
    if (window.MathJax && window.MathJax.typesetPromise && containerRef.current) {
      window.MathJax.typesetPromise([containerRef.current]).catch((err: any) =>
        console.warn('MathJax typeset error:', err)
      );
    }
  }, [rawHtml]);

  return (
    <div
      ref={containerRef}
      className={`math-content prose prose-slate max-w-none dark:prose-invert ${className}`}
      dangerouslySetInnerHTML={{ __html: rawHtml }}
    />
  );
};
