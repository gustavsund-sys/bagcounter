import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API, headers: { "Content-Type": "application/json" } });

export const api = {
    listBagTypes: () => client.get("/bag-types").then((r) => r.data),
    createBagType: (data) => client.post("/bag-types", data).then((r) => r.data),
    updateBagType: (id, data) => client.put(`/bag-types/${id}`, data).then((r) => r.data),
    deleteBagType: (id) => client.delete(`/bag-types/${id}`).then((r) => r.data),

    countPhoto: (image_base64, bag_types) =>
        client.post("/count-photo", { image_base64, bag_types }, { timeout: 90000 }).then((r) => r.data),

    listDailyCounts: () => client.get("/daily-counts").then((r) => r.data),
    getDailyCount: (id) => client.get(`/daily-counts/${id}`).then((r) => r.data),
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
