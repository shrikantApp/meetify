import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

interface TooltipProps {
  children: React.ReactElement;
  content: React.ReactNode;
  side?: TooltipSide;
  offset?: number;
  disabled?: boolean;
  className?: string;
}

interface TooltipPosition {
  top: number;
  left: number;
}

const TOOLTIP_GAP = 10;

export function Tooltip({
  children,
  content,
  side = 'top',
  offset = TOOLTIP_GAP,
  disabled = false,
  className = '',
}: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });

  const child = React.Children.only(children);

  const updatePosition = useMemo(
    () => () => {
      if (!triggerRef.current || !tooltipRef.current) {
        return;
      }

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 8;

      let top = 0;
      let left = 0;

      switch (side) {
        case 'right':
          top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
          left = triggerRect.right + offset;
          break;
        case 'bottom':
          top = triggerRect.bottom + offset;
          left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          break;
        case 'left':
          top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
          left = triggerRect.left - tooltipRect.width - offset;
          break;
        case 'top':
        default:
          top = triggerRect.top - tooltipRect.height - offset;
          left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
          break;
      }

      left = Math.min(Math.max(left, margin), viewportWidth - tooltipRect.width - margin);
      top = Math.min(Math.max(top, margin), viewportHeight - tooltipRect.height - margin);

      setPosition({ top, left });
    },
    [offset, side],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();

    const handleViewportChange = () => updatePosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => updatePosition());
    return () => window.cancelAnimationFrame(frame);
  }, [content, isOpen, updatePosition]);

  if (disabled || !content) {
    return child;
  }

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        aria-describedby={isOpen ? tooltipId : undefined}
      >
        {child}
      </span>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              className={`pointer-events-none fixed z-[600] rounded-xl border border-[var(--border-medium)] bg-[var(--bg-sidebar)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-primary)] shadow-2xl ${className}`}
              style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
              }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
