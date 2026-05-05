import React from "react";

export const Header = ({ overline, title, action }) => {
    return (
        <header className="sticky top-0 z-30 bg-bone pt-6 pb-4 px-5" data-testid="page-header">
            <div className="flex items-center gap-3 mb-4" data-testid="brand-strip">
                <img
                    src="/systembolaget.png"
                    alt="Systembolaget"
                    className="h-9 w-9 object-contain"
                    data-testid="systembolaget-logo"
                />
                <div className="font-chivo text-sm font-bold tracking-wide text-stone-900">
                    Systembolaget
                </div>
            </div>
            <div className="flex items-end justify-between gap-4">
                <div>
                    {overline && (
                        <div className="font-work text-[11px] uppercase tracking-[0.2em] font-semibold text-stone-500 mb-1">
                            {overline}
                        </div>
                    )}
                    <h1 className="font-chivo text-4xl font-black tracking-tight leading-none text-stone-900">
                        {title}
                    </h1>
                </div>
                {action}
            </div>
        </header>
    );
};
