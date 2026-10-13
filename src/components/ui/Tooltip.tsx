import { cloneElement, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";

export function Tooltip({ text, children }: { text: string; children: ReactElement<Record<string, unknown>> }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = (el: HTMLElement) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      setPos({ x: Math.min(r.left, window.innerWidth - 300), y: r.bottom + 6 });
    }, 350);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setPos(null);
  };
  const child = cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => show(e.currentTarget),
    onMouseLeave: hide,
    onMouseDown: hide,
    "aria-label": text,
  });
  return (
    <>
      {child}
      {pos && createPortal(<div className="tooltip" style={{ left: pos.x, top: pos.y }}>{text}</div>, document.body)}
    </>
  );
}
