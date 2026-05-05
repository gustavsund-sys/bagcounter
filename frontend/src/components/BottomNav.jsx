import React from "react";
import { NavLink } from "react-router-dom";
import { Camera, History, Layers } from "lucide-react";

const items = [
    { to: "/", label: "Idag", icon: Camera, testid: "nav-today" },
    { to: "/historik", label: "Historik", icon: History, testid: "nav-history" },
    { to: "/typer", label: "Typer", icon: Layers, testid: "nav-types" },
];

export const BottomNav = () => {
    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur-md"
            data-testid="bottom-nav"
        >
            <div className="max-w-md mx-auto flex justify-around items-center h-20 pb-2">
                {items.map(({ to, label, icon: Icon, testid }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === "/"}
                        data-testid={testid}
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-colors active:scale-95 ${
                                isActive ? "text-forest" : "text-stone-500"
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                                <span className="font-chivo text-xs font-bold tracking-wider uppercase">
                                    {label}
                                </span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};
