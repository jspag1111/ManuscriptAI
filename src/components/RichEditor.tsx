import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { contentToHtml, htmlToContent } from '@/utils/citationUtils';
import { Reference } from '@/types';

export interface RichEditorHandle {
  insertAtCursor: (text: string) => void;
  lockSelection: () => string | null;
  replaceLockedSelection: (text: string) => string;
  clearLock: () => void;
}

interface RichEditorProps {
  content: string;
  bibliographyOrder: string[];
  references: Reference[];
  onChange: (newContent: string) => void;
  onSelect?: (range: {start: number, end: number} | null, text: string) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
  placeholder?: string;
  className?: string;
  renderCitations?: boolean;
}

export const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(({
  content,
  bibliographyOrder,
  references,
  onChange,
  onSelect,
  onMouseUp,
  placeholder,
  className,
  renderCitations = false
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeCitation, setActiveCitation] = useState<{ ids: string[], rect: DOMRect } | null>(null);
  
  // Track cursor position
  const savedRange = useRef<Range | null>(null);

  // Track internal updates to avoid cursor jumping
  const isInternalUpdate = useRef(false);
  
  // Track if a selection is visually locked (e.g. for AI edit), preventing external updates from wiping DOM
  const isLocked = useRef(false);

  // Helper to save current selection range
  const saveCursor = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current?.contains(selection.anchorNode)) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
    }
  };

  function handleInput() {
    if (editorRef.current) {
      isInternalUpdate.current = true;
      const newContent = htmlToContent(editorRef.current);
      if (newContent !== content) {
        onChange(newContent);
      }
      saveCursor();
    }
  }

  useImperativeHandle(ref, () => ({
    insertAtCursor: (text: string) => {
      if (!editorRef.current) return;
      
      editorRef.current.focus();

      // Restore selection if we have it
      const selection = window.getSelection();
      if (selection && savedRange.current) {
        try {
          selection.removeAllRanges();
          selection.addRange(savedRange.current);
        } catch (e) {
          console.warn("Could not restore selection range", e);
        }
      }

      // Execute insert
      document.execCommand('insertText', false, text);
      
      // Update saved range to new position (after insertion)
      if (selection && selection.rangeCount > 0) {
        savedRange.current = selection.getRangeAt(0).cloneRange();
      }
      
      handleInput(); // Trigger content update
    },
    lockSelection: () => {
      const selection = window.getSelection();
      
      // Check if selection is valid and inside editor
      let range: Range | null = null;
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed && editorRef.current?.contains(selection.anchorNode)) {
          range = selection.getRangeAt(0);
      } else if (savedRange.current && !savedRange.current.collapsed) {
          // Fallback to saved range
          range = savedRange.current;
      }

      if (!range) return null;
      
      const text = range.toString();
      
      // Create highlight span
      const span = document.createElement('span');
      span.className = 'bg-blue-100 border-b-2 border-blue-400'; // Visual highlight
      span.dataset.aiLock = "true";
      
      try {
        range.surroundContents(span);
        selection?.removeAllRanges(); // Clear native selection so ours is the only one visible
        isLocked.current = true;
        return text;
      } catch (e) {
        console.error("Failed to wrap selection for lock", e);
        return text; // Fallback
      }
    },
    replaceLockedSelection: (text: string) => {
       const span = editorRef.current?.querySelector('[data-ai-lock="true"]');
       if (span) {
         // Create a text node with the new content
         const textNode = document.createTextNode(text);
         span.replaceWith(textNode);
         isLocked.current = false;
         
         // IMPORTANT: Do NOT call handleInput() here.
         // We are in the middle of a review flow (DiffViewer).
         // The parent component needs the NEW content string to show in diff,
         // but the CURRENT content state must remain unchanged until the user accepts the diff.
         
         return htmlToContent(editorRef.current!);
       }
       isLocked.current = false;
       return content;
    },
    clearLock: () => {
      const span = editorRef.current?.querySelector('[data-ai-lock="true"]');
      if (span) {
         // Unwrap: move children out and remove span
         const parent = span.parentNode;
         while (span.firstChild) {
             parent?.insertBefore(span.firstChild, span);
         }
         parent?.removeChild(span);
         editorRef.current?.normalize();
      }
      isLocked.current = false;
    }
  }));

  // Sync content prop to HTML
  useEffect(() => {
    if (editorRef.current) {
        // If locked (AI editing), DO NOT update DOM from props, as it would wipe the lock span
        if (isLocked.current) return;

        if (!isInternalUpdate.current) {
            editorRef.current.innerHTML = contentToHtml(content, bibliographyOrder, renderCitations);
        }
        isInternalUpdate.current = false;
    }
  }, [content, bibliographyOrder, renderCitations]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Check if clicked on a citation object
    if (target.classList.contains('citation-object') || target.closest('.citation-object')) {
        const pill = target.classList.contains('citation-object') ? target : target.closest('.citation-object') as HTMLElement;
        const ids = pill.getAttribute('data-ids')?.split(',') || [];
        const rect = pill.getBoundingClientRect();
        setActiveCitation({ ids, rect });
        e.stopPropagation(); 
    } else {
        setActiveCitation(null);
    }
    
    saveCursor();
  };

  const handleMouseUpInternal = (e: React.MouseEvent) => {
    saveCursor();
    
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && editorRef.current?.contains(selection.anchorNode)) {
        onSelect?.({ start: 0, end: 0 }, selection.toString()); 
    } else {
        onSelect?.(null, '');
    }

    if (onMouseUp) onMouseUp(e);
  };

  const removeReference = (idToRemove: string) => {
    if (!activeCitation) return;
    
    const newIds = activeCitation.ids.filter(id => id !== idToRemove);
    
    // Use the rect center to find the element again to be safe
    const pill = document.elementFromPoint(
        activeCitation.rect.left + activeCitation.rect.width / 2, 
        activeCitation.rect.top + activeCitation.rect.height / 2
    );
    
    if (pill && pill.classList.contains('citation-object')) {
        if (newIds.length === 0) {
            pill.remove();
        } else {
            pill.setAttribute('data-ids', newIds.join(','));
        }
        
        // Trigger update
        handleInput();
        
        // Force re-render of HTML to update the label (e.g. [1,2] -> [1])
        setTimeout(() => {
            isInternalUpdate.current = false;
            // Force refresh from the new content state
            if (editorRef.current) {
                const currentContent = htmlToContent(editorRef.current);
                editorRef.current.innerHTML = contentToHtml(currentContent, bibliographyOrder, renderCitations);
            }
        }, 0);
        
        if (newIds.length === 0) setActiveCitation(null);
        else setActiveCitation({ ...activeCitation, ids: newIds });
    }
  };

  // Determine popover position
  const getPopoverStyle = () => {
      if (!activeCitation) return {};
      const rect = activeCitation.rect;
      
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const maxH = 300; 

      // If strict space below is less than needed, and there is more space above, flip it.
      const showAbove = spaceBelow < 200 && spaceAbove > spaceBelow;

      if (showAbove) {
          const actualMaxHeight = Math.min(maxH, spaceAbove - 20);
          return {
              position: 'fixed',
              left: rect.left,
              bottom: window.innerHeight - rect.top + 6,
              maxHeight: `${actualMaxHeight}px`
          } as React.CSSProperties;
      }

      const actualMaxHeight = Math.min(maxH, spaceBelow - 20);
      return {
          position: 'fixed',
          left: rect.left,
          top: rect.bottom + 6,
          maxHeight: `${actualMaxHeight}px`
      } as React.CSSProperties;
  };

  return (
    <>
        <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className={`w-full h-full p-8 outline-none font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap ${className}`}
            onInput={handleInput}
            onClick={handleClick}
            onMouseUp={handleMouseUpInternal}
            onKeyUp={saveCursor}
            onBlur={saveCursor}
            data-placeholder={placeholder}
        />

        {/* Citation Management Popover */}
        {activeCitation && (
            <div 
                className="fixed z-50 bg-white shadow-xl border border-slate-200 rounded-lg p-3 min-w-[250px] max-w-[350px] animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col"
                style={getPopoverStyle()}
            >
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100 shrink-0">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">References</span>
                    <button onClick={() => setActiveCitation(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-50">
                        <X size={14} />
                    </button>
                </div>
                <div className="space-y-1 overflow-y-auto custom-scrollbar">
                    {activeCitation.ids.map(id => {
                        const ref = references.find(r => r.id === id);
                        return (
                            <div key={id} className="flex items-start justify-between p-2 hover:bg-slate-50 rounded group transition-colors">
                                <div className="text-sm font-medium text-slate-700 leading-snug mr-3 truncate w-full" title={ref?.title}>
                                    {ref?.title || 'Unknown Reference'}
                                </div>
                                <button 
                                    onClick={() => removeReference(id)}
                                    className="text-slate-300 hover:text-red-500 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hover:bg-red-50 rounded"
                                    title="Remove this citation"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
    </>
  );
});

RichEditor.displayName = 'RichEditor';
