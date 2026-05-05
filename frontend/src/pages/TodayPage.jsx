import React, { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { PhotoCapture } from "../components/PhotoCapture";
import { api, todayISO } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw, AlertTriangle, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

export default function TodayPage() {
    const [registers, setRegisters] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [count, setCount] = useState(0);
    const [isCounting, setIsCounting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [aiNote, setAiNote] = useState("");

    const load = async () => {
        const list = await api.listRegisters();
        setRegisters(list);
        if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
    };

    useEffect(() => {
        load();
    }, []);

    const selected = registers.find((r) => r.id === selectedId) || null;

    const onCount = async (dataUrl) => {
        if (!selected) return;
        setIsCounting(true);
        setAiNote("");
        try {
            const result = await api.countPhoto(dataUrl);
            setCount((prev) => prev + (result.count || 0));
            setAiNote(result.notes || "");
            toast.success(`AI räknade ${result.count} påsar`, {
                description: result.notes || "Justera värdet vid behov.",
            });
        } catch (e) {
            const msg = e?.response?.data?.detail || e.message || "Något gick fel";
            toast.error("Kunde inte räkna", { description: msg });
        } finally {
            setIsCounting(false);
        }
    };

    const reset = () => {
        setCount(0);
        setAiNote("");
        toast("Räkningen rensad");
    };

    const save = async () => {
        if (!selected) {
            toast.error("Välj en kassa först");
            return;
        }
        setIsSaving(true);
        try {
            await api.createDailyCount({
                date: todayISO(),
                register_id: selected.id,
                count,
                note: aiNote || "",
            });
            toast.success("Sparat!", {
                description: `${count} påsar för ${selected.name} är sparat i historiken.`,
            });
            setCount(0);
            setAiNote("");
        } catch (e) {
            toast.error("Kunde inte spara", { description: e.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="pb-32">
            <Header overline="Idag" title="Påsräknaren" />

            <section className="px-5 mb-5" data-testid="register-selector">
                <div className="font-work text-[11px] uppercase tracking-[0.2em] font-semibold text-stone-500 mb-2">
                    Välj kassa
                </div>
                {registers.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-4 text-sm text-stone-500 font-work">
                        Inga kassor ännu. Lägg till en i fliken Kassor.
                    </div>
                ) : (
                    <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
                        {registers.map((r) => {
                            const active = r.id === selectedId;
                            return (
                                <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => setSelectedId(r.id)}
                                    data-testid={`select-register-${r.id}`}
                                    className={`flex items-center gap-2 px-4 h-12 rounded-xl border whitespace-nowrap font-chivo font-bold text-sm transition-all active:scale-95 ${
                                        active
                                            ? "bg-forest text-white border-forest"
                                            : "bg-white text-stone-900 border-stone-200 hover:border-stone-300"
                                    }`}
                                >
                                    <span
                                        className="h-3 w-3 rounded-sm"
                                        style={{ backgroundColor: r.color || "#2A3B32" }}
                                    />
                                    {r.name}
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="px-5 mb-5" data-testid="total-card">
                <div className="bg-forest text-white rounded-3xl p-6 flex items-end justify-between">
                    <div>
                        <div className="font-work text-xs uppercase tracking-[0.2em] text-white/60 font-semibold">
                            Antal påsar
                        </div>
                        <div className="font-chivo text-7xl font-black tracking-tighter mt-1 pop-in" key={count}>
                            {count}
                        </div>
                        {selected && (
                            <div className="font-work text-xs text-white/70 mt-1">{selected.name}</div>
                        )}
                    </div>
                    <div className="text-right">
                        <div className="font-work text-xs uppercase tracking-[0.2em] text-white/60 font-semibold">
                            Datum
                        </div>
                        <div className="font-chivo text-base font-bold mt-1">
                            {new Date().toLocaleDateString("sv-SE", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                            })}
                        </div>
                    </div>
                </div>
            </section>

            <PhotoCapture onCount={onCount} isCounting={isCounting} bagTypesCount={registers.length} />

            {aiNote && (
                <div className="px-5 mt-3" data-testid="ai-note">
                    <div className="bg-kraft/20 border border-kraft/40 rounded-xl px-4 py-3 flex gap-2 items-start">
                        <AlertTriangle size={16} className="text-kraft-dark mt-0.5 flex-shrink-0" />
                        <p className="font-work text-sm text-stone-700">{aiNote}</p>
                    </div>
                </div>
            )}

            <section className="px-5 mt-6" data-testid="manual-adjust">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-chivo text-xl font-bold text-stone-900">Justera</h2>
                    <button
                        type="button"
                        onClick={reset}
                        className="font-work text-xs uppercase tracking-wider font-semibold text-stone-500 flex items-center gap-1 active:scale-95"
                        data-testid="reset-btn"
                    >
                        <RotateCcw size={14} /> Rensa
                    </button>
                </div>
                <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setCount((c) => Math.max(0, c - 1))}
                        className="h-14 w-14 flex-shrink-0 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 flex items-center justify-center"
                        data-testid="decrement-btn"
                        aria-label="Minska"
                    >
                        <Minus size={22} />
                    </button>
                    <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={count}
                        onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            setCount(isNaN(n) ? 0 : Math.max(0, n));
                        }}
                        className="flex-1 min-w-0 w-full h-14 text-center font-chivo font-black text-2xl bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-forest focus:border-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        data-testid="count-input"
                    />
                    <button
                        type="button"
                        onClick={() => setCount((c) => c + 1)}
                        className="h-14 w-14 flex-shrink-0 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-95 flex items-center justify-center"
                        data-testid="increment-btn"
                        aria-label="Öka"
                    >
                        <Plus size={22} />
                    </button>
                </div>
            </section>

            <section className="px-5 mt-6">
                <Button
                    type="button"
                    onClick={save}
                    disabled={isSaving || !selected}
                    className="w-full h-14 rounded-xl bg-forest hover:bg-forest-dark text-white font-chivo font-bold text-lg active:scale-[0.98] transition-transform"
                    data-testid="save-btn"
                >
                    <Save size={20} className="mr-2" />
                    {isSaving ? "Sparar..." : "Spara till historik"}
                </Button>
            </section>
        </div>
    );
}
