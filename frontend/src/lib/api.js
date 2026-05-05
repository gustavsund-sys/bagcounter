import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API, headers: { "Content-Type": "application/json" } });

export const api = {
    listRegisters: () => client.get("/registers").then((r) => r.data),
    createRegister: (data) => client.post("/registers", data).then((r) => r.data),
    updateRegister: (id, data) => client.put(`/registers/${id}`, data).then((r) => r.data),
    deleteRegister: (id) => client.delete(`/registers/${id}`).then((r) => r.data),

    countPhoto: (image_base64) =>
        client.post("/count-photo", { image_base64 }, { timeout: 90000 }).then((r) => r.data),

    listDailyCounts: (registerId) =>
        client
            .get("/daily-counts", { params: registerId ? { register_id: registerId } : {} })
            .then((r) => r.data),
    createDailyCount: (data) => client.post("/daily-counts", data).then((r) => r.data),
    deleteDailyCount: (id) => client.delete(`/daily-counts/${id}`).then((r) => r.data),
};

export const todayISO = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

export const formatDateSv = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
};
