import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export interface MenuEntry {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  separatorBefore?: boolean;
}

export function MenuList({ items, x, y, onClose }: { items: MenuEntry[]; x: number; y: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: Math.min(x, window.innerWidth - r.width - 8), y: Math.min(y, window.innerHeight - r.height - 8) });
  }, [x, y]);

  useEffect(() => {
    const close = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", close, true);
    window.addEventListener("blur", onClose);
    window.addEventListener("keydown", key, true);
    window.addEventListener("wheel", close, true);
    return () => {
      window.removeEventListener("mousedown", close, true);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("wheel", close, true);
    };
  }, [onClose]);

  return createPortal(
    <div ref={ref} className="menu" style={{ left: pos.x, top: pos.y }} role="menu">
      {items.map((it, i) => (
        <div key={i}>
          {it.separatorBefore && <div className="menu-sep" />}
          <button
            type="button"
            role="menuitem"
            className={cn("menu-item", it.danger && "danger")}
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onSelect();
            }}
          >
            {it.icon}
            {it.label}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

/** Opens a context menu at the cursor. */
export function useContextMenu() {
  const [state, setState] = useState<{ x: number; y: number; items: MenuEntry[] } | null>(null);
  const open = (e: React.MouseEvent, items: MenuEntry[]) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ x: e.clientX, y: e.clientY, items });
  };
  const element = state ? <MenuList {...state} onClose={() => setState(null)} /> : null;
  return { open, element };
}

/** Anchored dropdown opened from a trigger button. */
export function Dropdown({ trigger, items }: { trigger: (props: { onClick: (e: React.MouseEvent<HTMLElement>) => void; open: boolean }) => ReactNode; items: MenuEntry[] }) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  return (
    <>
      {trigger({
        open: anchor !== null,
        onClick: (e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAnchor({ x: r.left, y: r.bottom + 4 });
        },
      })}
      {anchor && <MenuList items={items} x={anchor.x} y={anchor.y} onClose={() => setAnchor(null)} />}
    </>
  );
}
