import React from "react";
import { Minus, Plus } from "lucide-react";

export const CountList = ({ bagTypes, counts, onChange }) => {
    const adjust = (id, delta) => {
        const next = Math.max(0, (counts[id] || 0) + delta);
        onChange({ ...counts, [id]: next });
    };

    const setVal = (id, raw) => {
        const n = parseInt(raw, 10);
        onChange({ ...counts, [id]: isNaN(n) ? 0 : Math.max(0, n) });
    };

    return (
        <div className="flex flex-col gap-3" data-testid="count-list">
            {bagTypes.map((t, idx) => {
                const v = counts[t.id] || 0;
                return (
                    <div
                        key={t.id}
                        className="reveal bg-white border border-stone-200 rounded-2xl p-4 flex items-center gap-3"
                        style={{ animationDelay: `${idx * 60}ms` }}
                        data-testid={`count-row-${t.id}`}
                    >
                        <div
                            className="h-12 w-12 rounded-xl flex-shrink-0"
                            style={{ backgroundColor: t.color || "#D4A373" }}
                            aria-hidden
                        />
                        <div className="flex-1 min-w-0">
                            <div className="font-chivo font-bold text-lg text-stone-900 truncate">
                                {t.name}
                            </div>
                            {t.description && (
                                <div className="font-work text-xs text-stone-500 truncate">
                                    {t.description}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => adjust(t.id, -1)}
                                className="h-11 w-11 rounded-lg bg-stone-100 hover:bg-stone-200 active:scale-95 flex items-center justify-center"
                                data-testid={`decrement-${t.id}`}
                                aria-label="Minska"
                            >
                                <Minus size={18} />
                            </button>
                            <input
                                type="number"
                                min="0"
                                value={v}
                                onChange={(e) => setVal(t.id, e.target.value)}
                                className="w-16 h-11 text-center font-chivo font-bold text-xl bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent outline-none"
                                data-testid={`count-input-${t.id}`}
                            />
                            <button
                                type="button"
                                onClick={() => adjust(t.id, 1)}
                                className="h-11 w-11 rounded-lg bg-stone-100 hover:bg-stone-200 active:scale-95 flex items-center justify-center"
                                data-testid={`increment-${t.id}`}
                                aria-label="Öka"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
