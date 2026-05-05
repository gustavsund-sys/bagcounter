import React, { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { PhotoCapture } from "../components/PhotoCapture";
import { CountList } from "../components/CountList";
import { api, todayISO } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function TodayPage() {
    const [bagTypes, setBagTypes] = useState([]);
    const [counts, setCounts] = useState({});
    const [isCounting, setIsCounting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [aiNote, setAiNote] = useState("");

    const load = async () => {
        const types = await api.listBagTypes();
        setBagTypes(types);
        setCounts((prev) => {
            const next = { ...prev };
            types.forEach((t) => {
                if (next[t.id] === undefined) next[t.id] = 0;
            });
            return next;
        });
    };

    useEffect(() => {
        load();
    }, []);

    const total = Object.values(counts).reduce((a, b) => a + (b || 0), 0);

    const onCount = async (dataUrl) => {
        if (bagTypes.length === 0) return;
        setIsCounting(true);
        setAiNote("");
        try {
            const result = await api.countPhoto(
                dataUrl,
                bagTypes.map((t) => ({ id: t.id, name: t.name, description: t.description || "" }))
            );
            setCounts((prev) => {
                const next = { ...prev };
                Object.entries(result.counts || {}).forEach(([id, v]) => {
                    next[id] = (prev[id] || 0) + (v || 0);
                });
                return next;
            });
            setAiNote(result.notes || "");
            toast.success("AI har räknat påsarna", {
                description: result.notes ? result.notes : "Justera värdena vid behov.",
            });
        } catch (e) {
            const msg = e?.response?.data?.detail || e.message || "Något gick fel";
            toast.error("Kunde inte räkna", { description: msg });
        } finally {
            setIsCounting(false);
        }
    };

    const reset = () => {
        const cleared = {};
        bagTypes.forEach((t) => (cleared[t.id] = 0));
        setCounts(cleared);
        setAiNote("");
        toast("Räkningen rensad");
    };

    const save = async () => {
        setIsSaving(true);
        try {
            await api.createDailyCount({
                date: todayISO(),
                counts,
                note: aiNote || "",
            });
            toast.success("Sparat!", { description: "Dagens räkning är sparad i historiken." });
        } catch (e) {
            toast.error("Kunde inte spara", { description: e.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="pb-32">
            <Header overline="Idag" title="Påsräknaren" />

            <section className="px-5 mb-4" data-testid="total-card">
                <div className="bg-forest text-white rounded-3xl p-6 flex items-end justify-between">
                    <div>
                        <div className="font-work text-xs uppercase tracking-[0.2em] text-white/60 font-semibold">
                            Totalt antal påsar
                        </div>
                        <div className="font-chivo text-6xl font-black tracking-tighter mt-1 pop-in" key={total}>
                            {total}
                        </div>
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

            <PhotoCapture onCount={onCount} isCounting={isCounting} bagTypesCount={bagTypes.length} />

            {aiNote && (
                <div className="px-5 mt-3" data-testid="ai-note">
                    <div className="bg-kraft/20 border border-kraft/40 rounded-xl px-4 py-3 flex gap-2 items-start">
                        <AlertTriangle size={16} className="text-kraft-dark mt-0.5 flex-shrink-0" />
                        <p className="font-work text-sm text-stone-700">{aiNote}</p>
                    </div>
                </div>
            )}

            <section className="px-5 mt-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-chivo text-xl font-bold text-stone-900">Per typ</h2>
                    <button
                        type="button"
                        onClick={reset}
                        className="font-work text-xs uppercase tracking-wider font-semibold text-stone-500 flex items-center gap-1 active:scale-95"
                        data-testid="reset-btn"
                    >
                        <RotateCcw size={14} /> Rensa
                    </button>
                </div>
                {bagTypes.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center">
                        <p className="font-work text-sm text-stone-500">
                            Inga påstyper ännu. Lägg till några i fliken Typer.
                        </p>
                    </div>
                ) : (
                    <CountList bagTypes={bagTypes} counts={counts} onChange={setCounts} />
                )}
            </section>

            <section className="px-5 mt-6">
                <Button
                    type="button"
                    onClick={save}
                    disabled={isSaving || bagTypes.length === 0}
                    className="w-full h-14 rounded-xl bg-forest hover:bg-forest-dark text-white font-chivo font-bold text-lg active:scale-[0.98] transition-transform"
                    data-testid="save-btn"
                >
                    <Save size={20} className="mr-2" />
                    {isSaving ? "Sparar..." : "Spara Dagens Antal"}
                </Button>
            </section>
        </div>
    );
}
