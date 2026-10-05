import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    tinymce: any;
    editorparameters: any;
    serviceUrl: string;
    resourcesUrl: string;
  }
}

interface TinyMceEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  placeholder?: string;
  disabled?: boolean;
}

export const TinyMceEditor: React.FC<TinyMceEditorProps> = ({
  value,
  onChange,
  height = 260,
  disabled = false,
}) => {
  const editorIdRef = useRef<string>(`tinymce-editor-${Math.random().toString(36).substring(2, 9)}`);
  const editorInstanceRef = useRef<any>(null);
  const isUpdatingRef = useRef<boolean>(false);

  useEffect(() => {
    let checkInterval: any = null;

    const initEditor = () => {
      if (!window.tinymce) return false;

      const element = document.getElementById(editorIdRef.current);
      if (!element) return false;

      // Clean up previous instance with this ID if any
      const existing = window.tinymce.get(editorIdRef.current);
      if (existing) {
        window.tinymce.remove(existing);
      }

      window.tinymce.init({
        selector: `#${editorIdRef.current}`,
        height,
        menubar: false,
        plugins: 'tiny_mce_wiris code table preview image charmap autoresize paste help wordcount lists',
        toolbar:
          'undo redo | tiny_mce_wiris_formulaEditor tiny_mce_wiris_formulaEditorChemistry | bold italic underline | bullist numlist | table image | alignleft aligncenter alignright | code preview',
        forced_root_block: '',
        extended_valid_elements: 'img[*],math[*],mrow[*],msqrt[*],mfrac[*],mn[*],mo[*],mi[*],msup[*],msub[*],msubsup[*]',
        custom_elements: 'math,mrow,msqrt,mfrac,mn,mo,mi,msup,msub,msubsup',
        content_style: `
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            color: #1e293b;
            padding: 10px;
          }
          img.Wirisformula {
            vertical-align: middle;
            display: inline-block;
            cursor: pointer;
          }
        `,
        language: 'vi',
        readonly: disabled ? 1 : 0,
        setup: (editor: any) => {
          editorInstanceRef.current = editor;

          editor.on('init', () => {
            if (value) {
              isUpdatingRef.current = true;
              editor.setContent(value);
              isUpdatingRef.current = false;
            }
          });

          const syncContent = () => {
            if (!isUpdatingRef.current) {
              const content = editor.getContent();
              onChange(content);
            }
          };

          editor.on('change keyup NodeChange undo redo blur SetContent ExecCommand', syncContent);
        },
      });

      return true;
    };

    if (!initEditor()) {
      checkInterval = setInterval(() => {
        if (window.tinymce && document.getElementById(editorIdRef.current)) {
          clearInterval(checkInterval);
          initEditor();
        }
      }, 80);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (window.tinymce && editorInstanceRef.current) {
        try {
          window.tinymce.remove(editorInstanceRef.current);
        } catch {
          // ignore
        }
        editorInstanceRef.current = null;
      }
    };
  }, []);

  // Sync content if value changes externally
  useEffect(() => {
    const editor = editorInstanceRef.current;
    if (editor && editor.initialized) {
      const current = editor.getContent();
      if (value !== current) {
        isUpdatingRef.current = true;
        editor.setContent(value || '');
        isUpdatingRef.current = false;
      }
    }
  }, [value]);

  return (
    <div className="w-full relative">
      <textarea
        id={editorIdRef.current}
        defaultValue={value}
        className="w-full opacity-0 pointer-events-none absolute h-0"
      />
    </div>
  );
};
