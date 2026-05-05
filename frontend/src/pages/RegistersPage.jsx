import React, { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { api } from "../lib/api";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const COLOR_OPTIONS = ["#E0C9A6", "#D4A373", "#A88358", "#7C5A3A", "#2A3B32", "#5A7A6E", "#8B6F47", "#C9A78C"];

export default function RegistersPage() {
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [newColor, setNewColor] = useState(COLOR_OPTIONS[1]);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editColor, setEditColor] = useState(COLOR_OPTIONS[1]);

    const load = async () => {
        setLoading(true);
        const list = await api.listRegisters();
        setTypes(list);
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    const create = async () => {
        if (!newName.trim()) {
            toast.error("Ange ett namn");
            return;
        }
        try {
            const created = await api.createRegister({
                name: newName.trim(),
                description: newDesc.trim(),
                color: newColor,
            });
            setTypes((prev) => [...prev, created]);
            setNewName("");
            setNewDesc("");
            setNewColor(COLOR_OPTIONS[1]);
            setShowAdd(false);
            toast.success("Kassa tillagd");
        } catch (e) {
            toast.error("Kunde inte skapa", { description: e.message });
        }
    };

    const startEdit = (t) => {
        setEditingId(t.id);
        setEditName(t.name);
        setEditDesc(t.description || "");
        setEditColor(t.color || COLOR_OPTIONS[1]);
    };

    const saveEdit = async () => {
        if (!editName.trim()) return;
        try {
            const updated = await api.updateRegister(editingId, {
                name: editName.trim(),
                description: editDesc.trim(),
                color: editColor,
            });
            setTypes((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            setEditingId(null);
            toast.success("Uppdaterad");
        } catch (e) {
            toast.error("Kunde inte uppdatera", { description: e.message });
        }
    };

    const remove = async (id) => {
        try {
            await api.deleteRegister(id);
            setTypes((prev) => prev.filter((t) => t.id !== id));
            toast.success("Borttagen");
        } catch (e) {
            toast.error("Kunde inte ta bort", { description: e.message });
        }
    };

    return (
        <div className="pb-32">
            <Header
                overline="Inställningar"
                title="Kassor"
                action={
                    <Button
                        type="button"
                        onClick={() => setShowAdd((s) => !s)}
                        className="h-12 px-4 rounded-xl bg-forest hover:bg-forest-dark text-white font-chivo font-bold active:scale-95"
                        data-testid="toggle-add-register-btn"
                    >
                        <Plus size={18} className="mr-1" /> Ny
                    </Button>
                }
            />

            {showAdd && (
                <section className="px-5 mb-4" data-testid="add-register-form">
                    <div className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-col gap-3">
                        <Input
                            placeholder="Namn (t.ex. Kassa 1)"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="h-12 rounded-xl"
                            data-testid="new-register-name"
                        />
                        <Input
                            placeholder="Beskrivning (valfritt)"
                            value={newDesc}
                            onChange={(e) => setNewDesc(e.target.value)}
                            className="h-12 rounded-xl"
                            data-testid="new-register-desc"
                        />
                        <ColorPicker value={newColor} onChange={setNewColor} testidPrefix="new" />
                        <div className="grid grid-cols-2 gap-2 mt-1">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowAdd(false)}
                                className="h-12 rounded-xl font-chivo font-bold"
                                data-testid="cancel-add-register-btn"
                            >
                                Avbryt
                            </Button>
                            <Button
                                type="button"
                                onClick={create}
                                className="h-12 rounded-xl bg-forest hover:bg-forest-dark text-white font-chivo font-bold"
                                data-testid="confirm-add-register-btn"
                            >
                                Lägg till
                            </Button>
                        </div>
                    </div>
                </section>
            )}

            <section className="px-5">
                {loading ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center font-work text-sm text-stone-500">
                        Laddar...
                    </div>
                ) : types.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
                        <p className="font-chivo text-lg font-bold text-stone-900">Inga kassor</p>
                        <p className="font-work text-sm text-stone-500 mt-1">
                            Lägg till din första kassa för att börja räkna.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3" data-testid="registers-list">
                        {types.map((t) => (
                            <div
                                key={t.id}
                                className="bg-white border border-stone-200 rounded-2xl p-4"
                                data-testid={`register-row-${t.id}`}
                            >
                                {editingId === t.id ? (
                                    <div className="flex flex-col gap-3">
                                        <Input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="h-11 rounded-xl"
                                            data-testid={`edit-name-${t.id}`}
                                        />
                                        <Input
                                            value={editDesc}
                                            onChange={(e) => setEditDesc(e.target.value)}
                                            placeholder="Beskrivning"
                                            className="h-11 rounded-xl"
                                            data-testid={`edit-desc-${t.id}`}
                                        />
                                        <ColorPicker
                                            value={editColor}
                                            onChange={setEditColor}
                                            testidPrefix={`edit-${t.id}`}
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setEditingId(null)}
                                                className="h-11 rounded-xl font-chivo font-bold"
                                                data-testid={`cancel-edit-${t.id}`}
                                            >
                                                <X size={16} className="mr-1" /> Avbryt
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={saveEdit}
                                                className="h-11 rounded-xl bg-forest hover:bg-forest-dark text-white font-chivo font-bold"
                                                data-testid={`save-edit-${t.id}`}
                                            >
                                                <Check size={16} className="mr-1" /> Spara
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="h-12 w-12 rounded-xl flex-shrink-0"
                                            style={{ backgroundColor: t.color || "#D4A373" }}
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
                                        <button
                                            type="button"
                                            onClick={() => startEdit(t)}
                                            className="h-10 w-10 rounded-lg bg-stone-100 hover:bg-stone-200 active:scale-95 flex items-center justify-center"
                                            data-testid={`edit-${t.id}`}
                                            aria-label="Redigera"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="h-10 w-10 rounded-lg bg-stone-100 hover:bg-red-100 hover:text-red-700 active:scale-95 flex items-center justify-center"
                                                    data-testid={`delete-${t.id}`}
                                                    aria-label="Ta bort"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Ta bort {t.name}?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Befintlig historik påverkas inte.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel data-testid={`cancel-delete-${t.id}`}>
                                                        Avbryt
                                                    </AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => remove(t.id)}
                                                        data-testid={`confirm-delete-${t.id}`}
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
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

const ColorPicker = ({ value, onChange, testidPrefix }) => {
    return (
        <div className="flex flex-wrap gap-2" data-testid={`${testidPrefix}-color-picker`}>
            {COLOR_OPTIONS.map((c) => (
                <button
                    key={c}
                    type="button"
                    onClick={() => onChange(c)}
                    className={`h-9 w-9 rounded-lg border-2 transition-transform active:scale-90 ${
                        value === c ? "border-stone-900" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    data-testid={`${testidPrefix}-color-${c.replace("#", "")}`}
                    aria-label={`Färg ${c}`}
                />
            ))}
        </div>
    );
};
