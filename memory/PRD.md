# Påsräknaren — PRD

## Original problem statement
> "kan du skapa en webapplikation som kan räkna påsarna åt mig"
> (Swedish: a web app to count paper bags / kraftpåsar at a grocery store checkout)

## User choices (from ask_human + follow-up)
- Counting method: AI from photo → returns single total count
- Categories: ONE bag type (no per-type breakdown)
- Selection: user picks which **kassa** (cash register) the count is for
- History: save per kassa per save
- Auth: none (open app)

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Vision LLM via `emergentintegrations` using Gemini 2.5 Pro and `EMERGENT_LLM_KEY`.
- **Frontend**: React (CRA + craco), TailwindCSS, shadcn/ui, lucide-react icons, sonner toasts. Mobile-first kraft-minimalism design (Chivo + Work Sans, deep forest green primary).

## Personas
- Grocery store / supermarket checkout worker (Swedish), counting paper-bag stock per register during a shift on their phone.

## Core requirements (static)
- Take/upload photo → AI counts **total** bags in image
- Select which kassa (register) the count is for
- Manual +/- adjustments after AI suggestion
- CRUD for registers (kassor)
- Save counts (per register, timestamped); view & filter history; delete records

## Implemented
- 2026-02 (v1): per-type (Liten/Mellan/Stor påse) counting → REPLACED in v2
- 2026-02 (v2): Refactored to one count + register selection
  - `/api/registers` CRUD + auto-seeded Kassa 1/2/3
  - `/api/count-photo` returns `{count, notes}` (single int)
  - `/api/daily-counts` with `register_id`, `register_name` snapshot, `count`, `note` + filter by register
  - One-time startup migration removes legacy daily-count records
  - Frontend: register pill selector, single count display, +/- adjuster, save resets count
  - History page with grand-total card + filter pills (Alla / per kassa)
  - 12/12 backend pytest passes; 100% frontend critical flows pass

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
