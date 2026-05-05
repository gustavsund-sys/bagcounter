import React, { useEffect, useMemo, useState } from "react";
import { Header } from "../components/Header";
import { api, formatDateSv } from "../lib/api";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function HistoryPage() {
    const [items, setItems] = useState([]);
    const [registers, setRegisters] = useState([]);
    const [filter, setFilter] = useState("all"); // "all" or register id
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        const [list, regs] = await Promise.all([api.listDailyCounts(), api.listRegisters()]);
        setItems(list);
        setRegisters(regs);
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    const registerColor = (id) => registers.find((r) => r.id === id)?.color || "#2A3B32";

    const remove = async (id) => {
        try {
            await api.deleteDailyCount(id);
            setItems((prev) => prev.filter((i) => i.id !== id));
            toast.success("Borttaget");
        } catch (e) {
            toast.error("Kunde inte ta bort", { description: e.message });
        }
    };

    const filtered = useMemo(
        () => (filter === "all" ? items : items.filter((i) => i.register_id === filter)),
        [items, filter]
    );

    const grandTotal = filtered.reduce((a, b) => a + (b.count || 0), 0);

    const formatTime = (iso) => {
        try {
            return new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
        } catch {
            return "";
        }
    };

    return (
        <div className="pb-32">
            <Header overline="Översikt" title="Historik" />

            <section className="px-5 mb-4" data-testid="history-summary">
                <div className="bg-forest text-white rounded-3xl p-5 flex items-end justify-between">
                    <div>
                        <div className="font-work text-xs uppercase tracking-[0.2em] text-white/60 font-semibold">
                            {filter === "all"
                                ? "Totalt"
                                : registers.find((r) => r.id === filter)?.name || "Filter"}
                        </div>
                        <div className="font-chivo text-5xl font-black tracking-tighter mt-1">
                            {grandTotal}
                        </div>
                        <div className="font-work text-xs text-white/70 mt-1">
                            över {filtered.length} {filtered.length === 1 ? "räkning" : "räkningar"}
                        </div>
                    </div>
                </div>
            </section>

            {registers.length > 0 && (
                <section className="px-5 mb-4" data-testid="history-filter">
                    <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
                        <button
                            type="button"
                            onClick={() => setFilter("all")}
                            data-testid="filter-all"
                            className={`px-4 h-10 rounded-full border whitespace-nowrap font-chivo font-bold text-xs uppercase tracking-wider transition-all active:scale-95 ${
                                filter === "all"
                                    ? "bg-stone-900 text-white border-stone-900"
                                    : "bg-white text-stone-700 border-stone-200"
                            }`}
                        >
                            Alla
                        </button>
                        {registers.map((r) => (
                            <button
                                key={r.id}
                                type="button"
                                onClick={() => setFilter(r.id)}
                                data-testid={`filter-${r.id}`}
                                className={`flex items-center gap-2 px-4 h-10 rounded-full border whitespace-nowrap font-chivo font-bold text-xs uppercase tracking-wider transition-all active:scale-95 ${
                                    filter === r.id
                                        ? "bg-stone-900 text-white border-stone-900"
                                        : "bg-white text-stone-700 border-stone-200"
                                }`}
                            >
                                <span
                                    className="h-2.5 w-2.5 rounded-sm"
                                    style={{ backgroundColor: r.color || "#2A3B32" }}
                                />
                                {r.name}
                            </button>
                        ))}
                    </div>
                </section>
            )}

            <section className="px-5">
                {loading ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center font-work text-sm text-stone-500">
                        Laddar...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
                        <p className="font-chivo text-lg font-bold text-stone-900">Ingen historik ännu</p>
                        <p className="font-work text-sm text-stone-500 mt-1">
                            Spara din första räkning för att se den här.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3" data-testid="history-list">
                        {filtered.map((it, idx) => (
                            <div
                                key={it.id}
                                className="reveal bg-white border border-stone-200 rounded-2xl p-4 flex items-center gap-3"
                                style={{ animationDelay: `${idx * 40}ms` }}
                                data-testid={`history-item-${it.id}`}
                            >
                                <div
                                    className="h-12 w-1.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: registerColor(it.register_id) }}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="font-chivo font-bold text-base text-stone-900 truncate">
                                        {it.register_name || "Okänd kassa"}
                                    </div>
                                    <div className="font-work text-xs text-stone-500 capitalize">
                                        {formatDateSv(it.date)} · {formatTime(it.created_at)}
                                    </div>
                                    {it.note && (
                                        <p className="font-work text-xs text-stone-400 italic mt-1 line-clamp-1">
                                            "{it.note}"
                                        </p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="font-chivo text-3xl font-black text-stone-900 tracking-tighter">
                                        {it.count}
                                    </div>
                                    <div className="font-work text-[10px] uppercase tracking-widest text-stone-500 font-semibold">
                                        påsar
                                    </div>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <button
                                            type="button"
                                            className="h-10 w-10 rounded-lg bg-stone-50 hover:bg-red-50 hover:text-red-600 active:scale-95 flex items-center justify-center text-stone-400"
                                            data-testid={`delete-history-${it.id}`}
                                            aria-label="Ta bort"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Ta bort räkning?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {it.register_name} · {it.count} påsar · {formatDateSv(it.date)}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel data-testid={`cancel-delete-${it.id}`}>
                                                Avbryt
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => remove(it.id)}
                                                data-testid={`confirm-delete-${it.id}`}
                                                className="bg-red-600 hover:bg-red-700"
                                            >
                                                Ta bort
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
