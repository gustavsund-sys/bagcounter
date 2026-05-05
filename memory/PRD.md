# Påsräknaren — PRD

## Original problem statement
> "kan du skapa en webapplikation som kan räkna påsarna åt mig"
> (Swedish: a web app to count paper bags / kraftpåsar at a grocery store checkout)

## User choices (from ask_human)
- Counting method: AI from photo
- Bag types: customizable (add/edit/delete)
- History: save daily counts
- Auth: none (open app)

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Vision LLM via `emergentintegrations` using Gemini 2.5 Pro and `EMERGENT_LLM_KEY`.
- **Frontend**: React (CRA + craco), TailwindCSS, shadcn/ui, lucide-react icons, sonner toasts. Mobile-first kraft-minimalism design (Chivo + Work Sans, deep forest green primary).

## Personas
- Grocery store / supermarket checkout worker (Swedish), counting paper-bag stock during a shift on their phone.

## Core requirements (static)
- Take/upload photo → AI counts bags per user-defined category
- Manual +/- adjustments after AI suggestion
- CRUD for bag types
- Save daily counts; view history; delete records

## Implemented (2026-02)
- `/api/bag-types` CRUD + auto-seeded defaults (Liten/Mellan/Stor påse)
- `/api/count-photo` Gemini 2.5 Pro vision counting with structured JSON output and per-id normalization
- `/api/daily-counts` create/list/get/delete
- 3 pages with bottom nav (Idag, Historik, Typer)
- PhotoCapture with camera/gallery, client-side resize to 1600px JPEG
- Toasts, confirm dialogs (alert-dialog), reveal animations, scanline AI loader
- 100% pytest backend coverage + frontend critical flows pass

## Backlog
- **P1**: Calendar view in History (group by month, totals); CSV export
- **P1**: Drag-to-reorder bag types
- **P2**: Multi-day stats / charts (recharts is installed)
- **P2**: PWA install + offline mode
- **P2**: Optional auth + multi-store/branch support
- **P2**: Save the photo thumbnail with each daily count for review

## Next tasks
- Calendar/charts on history
- CSV export of historik
- Reorder / drag bag types
