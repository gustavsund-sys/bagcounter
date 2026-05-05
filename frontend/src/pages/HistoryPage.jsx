import React, { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { api, formatDateSv } from "../lib/api";
import { Trash2, ChevronRight } from "lucide-react";
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
    const [bagTypes, setBagTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(null);

    const load = async () => {
        setLoading(true);
        const [list, types] = await Promise.all([api.listDailyCounts(), api.listBagTypes()]);
        setItems(list);
        setBagTypes(types);
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    const typeName = (id) => bagTypes.find((t) => t.id === id)?.name || "Okänd typ";
    const typeColor = (id) => bagTypes.find((t) => t.id === id)?.color || "#D4A373";

    const remove = async (id) => {
        try {
            await api.deleteDailyCount(id);
            setItems((prev) => prev.filter((i) => i.id !== id));
            toast.success("Borttaget");
        } catch (e) {
            toast.error("Kunde inte ta bort", { description: e.message });
        }
    };

    const totalOf = (counts) => Object.values(counts || {}).reduce((a, b) => a + (b || 0), 0);

    return (
        <div className="pb-32">
            <Header overline="Översikt" title="Historik" />

            <section className="px-5">
                {loading ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center font-work text-sm text-stone-500">
                        Laddar...
                    </div>
                ) : items.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
                        <p className="font-chivo text-lg font-bold text-stone-900">Ingen historik ännu</p>
                        <p className="font-work text-sm text-stone-500 mt-1">
                            Spara din första räkning för att se den här.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3" data-testid="history-list">
                        {items.map((it, idx) => {
                            const isOpen = expanded === it.id;
                            return (
                                <div
                                    key={it.id}
                                    className="reveal bg-white border border-stone-200 rounded-2xl overflow-hidden"
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                    data-testid={`history-item-${it.id}`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setExpanded(isOpen ? null : it.id)}
                                        className="w-full text-left p-4 flex items-center gap-3"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="font-chivo font-bold text-lg text-stone-900 capitalize">
                                                {formatDateSv(it.date)}
                                            </div>
                                            <div className="font-work text-xs text-stone-500">
                                                {it.date}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-chivo text-3xl font-black text-stone-900 tracking-tighter">
                                                {totalOf(it.counts)}
                                            </div>
                                            <div className="font-work text-[10px] uppercase tracking-widest text-stone-500 font-semibold">
                                                påsar
                                            </div>
                                        </div>
                                        <ChevronRight
                                            size={20}
                                            className={`text-stone-400 transition-transform ${
                                                isOpen ? "rotate-90" : ""
                                            }`}
                                        />
                                    </button>
                                    {isOpen && (
                                        <div className="px-4 pb-4 border-t border-stone-100 pt-3">
                                            <ul className="flex flex-col gap-2">
                                                {Object.entries(it.counts || {}).map(([tid, val]) => (
                                                    <li
                                                        key={tid}
                                                        className="flex items-center gap-3"
                                                        data-testid={`history-detail-${it.id}-${tid}`}
                                                    >
                                                        <span
                                                            className="h-3 w-3 rounded-sm"
                                                            style={{ backgroundColor: typeColor(tid) }}
                                                        />
                                                        <span className="flex-1 font-work text-sm text-stone-700">
                                                            {typeName(tid)}
                                                        </span>
                                                        <span className="font-chivo font-bold text-stone-900">
                                                            {val}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                            {it.note && (
                                                <p className="mt-3 font-work text-xs text-stone-500 italic">
                                                    "{it.note}"
                                                </p>
                                            )}
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <button
                                                        type="button"
                                                        className="mt-3 inline-flex items-center gap-2 text-sm font-work font-semibold text-red-600 active:scale-95"
                                                        data-testid={`delete-history-${it.id}`}
                                                    >
                                                        <Trash2 size={14} /> Ta bort
                                                    </button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Ta bort räkning?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Den här åtgärden kan inte ångras.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel data-testid="cancel-delete-history">
                                                            Avbryt
                                                        </AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => remove(it.id)}
                                                            data-testid="confirm-delete-history"
                                                            className="bg-red-600 hover:bg-red-700"
                                                        >
                                                            Ta bort
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
