import "@/App.css";
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { BottomNav } from "./components/BottomNav";
import TodayPage from "./pages/TodayPage";
import HistoryPage from "./pages/HistoryPage";
import RegistersPage from "./pages/RegistersPage";

function App() {
    return (
        <div className="App min-h-screen bg-bone">
            <BrowserRouter>
                <div className="max-w-md mx-auto bg-bone min-h-screen relative">
                    <Routes>
                        <Route path="/" element={<TodayPage />} />
                        <Route path="/historik" element={<HistoryPage />} />
                        <Route path="/kassor" element={<RegistersPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                    <BottomNav />
                </div>
                <Toaster
                    position="top-center"
                    toastOptions={{
                        className: "font-work",
                        style: { background: "#FFFFFF", border: "1px solid #E7E5E4", color: "#1C1917" },
                    }}
                />
            </BrowserRouter>
        </div>
    );
}

export default App;
