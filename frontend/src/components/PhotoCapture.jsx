import React, { useRef, useState } from "react";
import { Camera, ImageIcon, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// Read file -> resized base64 JPEG (max 1600px on longest edge)
async function fileToResizedBase64(file, maxDim = 1600, quality = 0.85) {
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = dataUrl;
    });
    let { width, height } = img;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
}

export const PhotoCapture = ({ onCount, isCounting, bagTypesCount }) => {
    const cameraInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const [preview, setPreview] = useState(null);

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const dataUrl = await fileToResizedBase64(file);
        setPreview(dataUrl);
        onCount(dataUrl);
        e.target.value = "";
    };

    return (
        <div className="px-5">
            <div
                className="relative rounded-3xl overflow-hidden border border-stone-200 bg-white"
                data-testid="photo-capture-area"
            >
                {preview ? (
                    <div className="relative aspect-[4/3] bg-stone-900">
                        <img src={preview} alt="Förhandsvisning" className="w-full h-full object-cover" />
                        {isCounting && (
                            <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center text-white">
                                <div className="absolute inset-0 overflow-hidden">
                                    <div className="scanline" />
                                </div>
                                <Sparkles size={36} className="mb-3 text-kraft" />
                                <div className="font-chivo text-xl font-bold">Räknar påsar...</div>
                                <div className="font-work text-sm text-white/70 mt-1">
                                    AI analyserar bilden
                                </div>
                            </div>
                        )}
                        {!isCounting && (
                            <button
                                type="button"
                                onClick={() => setPreview(null)}
                                className="absolute top-3 right-3 h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-95"
                                data-testid="clear-photo-btn"
                                aria-label="Rensa bild"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="aspect-[4/3] flex flex-col items-center justify-center gap-2 bg-stone-50 text-stone-400">
                        <Camera size={48} strokeWidth={1.4} />
                        <div className="font-work text-sm text-stone-500">
                            Ta en bild av påsfacken
                        </div>
                    </div>
                )}
            </div>

            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFile}
                data-testid="camera-input"
            />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFile}
                data-testid="file-input"
            />

            <div className="grid grid-cols-2 gap-3 mt-4">
                <Button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isCounting || bagTypesCount === 0}
                    className="h-14 rounded-xl bg-forest hover:bg-forest-dark text-white font-chivo font-bold text-base active:scale-[0.98] transition-transform"
                    data-testid="take-photo-btn"
                >
                    <Camera size={20} className="mr-2" /> Ta Bild
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCounting || bagTypesCount === 0}
                    className="h-14 rounded-xl border border-stone-200 bg-white text-stone-900 font-chivo font-bold text-base active:scale-[0.98] transition-transform hover:bg-stone-50"
                    data-testid="upload-photo-btn"
                >
                    <ImageIcon size={20} className="mr-2" /> Välj bild
                </Button>
            </div>
            {bagTypesCount === 0 && (
                <p className="mt-3 text-sm text-stone-500" data-testid="no-types-warning">
                    Lägg till minst en kassa i fliken <strong>Kassor</strong> först.
                </p>
            )}
        </div>
    );
};
