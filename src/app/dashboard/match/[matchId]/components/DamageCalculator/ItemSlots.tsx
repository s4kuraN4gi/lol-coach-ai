"use client";

import { useState, useCallback } from "react";

type Props = {
  items: (string | null)[];
  version: string;
  itemDataMap: Record<string, any> | null;
  onItemClick: (slotIndex: number) => void;
  onItemRemove: (slotIndex: number) => void;
  onItemSwap: (fromIndex: number, toIndex: number) => void;
  onExternalItemDrop?: (slotIndex: number, itemId: string) => void;
};

/**
 * Clean up DDragon item description HTML for display.
 * Converts game-specific tags to styled spans.
 */
function parseItemDescription(html: string): string {
  return html
    // Remove wrapping <mainText> tags
    .replace(/<\/?mainText>/gi, "")
    // Convert <br> to newlines
    .replace(/<br\s*\/?>/gi, "\n")
    // Style <attention> as highlighted values
    .replace(/<attention>/gi, '<span class="text-white font-semibold">')
    .replace(/<\/attention>/gi, "</span>")
    // Style <stats> block
    .replace(/<stats>/gi, '<div class="mb-1">')
    .replace(/<\/stats>/gi, "</div>")
    // Style <passive> / <active> labels
    .replace(/<passive>/gi, '<span class="text-sky-300 font-semibold">')
    .replace(/<\/passive>/gi, "</span>")
    .replace(/<active>/gi, '<span class="text-amber-300 font-semibold">')
    .replace(/<\/active>/gi, "</span>")
    // Style damage type tags
    .replace(/<physicalDamage>/gi, '<span class="text-orange-400">')
    .replace(/<\/physicalDamage>/gi, "</span>")
    .replace(/<magicDamage>/gi, '<span class="text-purple-400">')
    .replace(/<\/magicDamage>/gi, "</span>")
    .replace(/<trueDamage>/gi, '<span class="text-white">')
    .replace(/<\/trueDamage>/gi, "</span>")
    .replace(/<healing>/gi, '<span class="text-green-400">')
    .replace(/<\/healing>/gi, "</span>")
    .replace(/<shield>/gi, '<span class="text-slate-300">')
    .replace(/<\/shield>/gi, "</span>")
    // Style special keywords
    .replace(/<keywordMajor>/gi, '<span class="text-amber-200 font-semibold">')
    .replace(/<\/keywordMajor>/gi, "</span>")
    .replace(/<keywordStealth>/gi, '<span class="text-slate-300">')
    .replace(/<\/keywordStealth>/gi, "</span>")
    // Style status tags
    .replace(/<status>/gi, '<span class="text-rose-300">')
    .replace(/<\/status>/gi, "</span>")
    // Strip remaining unknown tags (OnHit, scaleAP, scaleAD, rules, etc.)
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9]*>/g, "")
    // Clean up HTML entities
    .replace(/&nbsp;/g, " ")
    .trim();
}

function ItemTooltip({ itemId, itemDataMap }: { itemId: string; itemDataMap: Record<string, any> | null }) {
  const item = itemDataMap?.[itemId];
  if (!item) return null;

  const descriptionHtml = item.description ? parseItemDescription(item.description) : "";

  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-60">
      <div className="bg-slate-900 border border-slate-600 rounded-lg shadow-2xl p-2.5 text-left max-h-72 overflow-y-auto">
        {/* Item name + gold */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-bold text-amber-300 truncate">{item.name}</span>
          {item.gold?.total > 0 && (
            <span className="text-[10px] text-yellow-500 flex-shrink-0">{item.gold.total}g</span>
          )}
        </div>

        {/* Parsed description HTML */}
        {descriptionHtml && (
          <div
            className="text-[10px] text-slate-300 leading-relaxed whitespace-pre-line [&_div]:mb-1"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        )}
      </div>
    </div>
  );
}

export default function ItemSlots({ items, version, itemDataMap, onItemClick, onItemRemove, onItemSwap, onExternalItemDrop }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (!items[index]) return;
    setDragIndex(index);
    setHoverIndex(null);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }, [items]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    const isExternal = e.dataTransfer.types.includes("item-id");
    e.dataTransfer.dropEffect = isExternal ? "copy" : "move";
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const externalItemId = e.dataTransfer.getData("item-id");
    if (externalItemId && onExternalItemDrop) {
      onExternalItemDrop(toIndex, externalItemId);
    } else {
      const fromIndex = dragIndex;
      if (fromIndex !== null && fromIndex !== toIndex) {
        onItemSwap(fromIndex, toIndex);
      }
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, onItemSwap, onExternalItemDrop]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  return (
    <div className="grid grid-cols-3 gap-1">
      {items.map((itemId, idx) => (
        <div
          key={idx}
          draggable={!!itemId}
          onDragStart={(e) => handleDragStart(e, idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={(e) => handleDrop(e, idx)}
          onDragEnd={handleDragEnd}
          onMouseEnter={() => { if (itemId && dragIndex === null) setHoverIndex(idx); }}
          onMouseLeave={() => setHoverIndex(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            if (itemId) onItemRemove(idx);
          }}
          onClick={() => onItemClick(idx)}
          className={`relative w-9 h-9 rounded border cursor-pointer transition-all group ${
            dragOverIndex === idx
              ? "border-blue-400 bg-blue-500/20 scale-110"
              : dragIndex === idx
                ? "opacity-50 border-slate-600"
                : itemId
                  ? "border-slate-700 bg-slate-800 hover:border-slate-500"
                  : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600 border-dashed"
          }`}
        >
          {itemId ? (
            <>
              <img
                src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`}
                alt={`Item ${itemId}`}
                className="w-full h-full rounded object-cover"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              {/* Remove button on hover */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onItemRemove(idx);
                }}
                className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                x
              </button>
              {/* Item detail tooltip */}
              {hoverIndex === idx && (
                <ItemTooltip itemId={itemId} itemDataMap={itemDataMap} />
              )}
            </>
          ) : (
            <span className="text-slate-600 text-lg flex items-center justify-center w-full h-full">+</span>
          )}
        </div>
      ))}
    </div>
  );
}
