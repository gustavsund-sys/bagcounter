"""Backend tests for Påsräknaren API (refactored schema: Registers + single count)."""
import io
import base64
import datetime
import pytest
import requests
from PIL import Image, ImageDraw


# --- Image helper ---
def _make_real_jpeg_b64() -> str:
    """Create a real JPEG with visible features (stacks of bag-like rectangles)."""
    img = Image.new("RGB", (640, 480), (245, 230, 210))
    d = ImageDraw.Draw(img)
    for x in range(0, 640, 20):
        d.line([(x, 0), (x, 480)], fill=(230, 215, 195), width=1)
    palettes = [(212, 163, 115), (168, 131, 88), (224, 201, 166)]
    for i, color in enumerate(palettes):
        x0 = 30 + i * 200
        d.rectangle([x0, 60, x0 + 160, 420], outline=(80, 60, 40), width=3)
        for j in range(5):
            y = 80 + j * 60
            d.rectangle([x0 + 15, y, x0 + 145, y + 50], fill=color, outline=(60, 40, 20), width=2)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# --- Health ---
class TestHealth:
    def test_root(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        assert "Påsräknaren" in data.get("message", "")


# --- Old endpoints removed ---
class TestOldEndpointsRemoved:
    def test_bag_types_returns_404(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/bag-types")
        assert r.status_code == 404


# --- Registers (Kassor) CRUD ---
class TestRegisters:
    def test_list_seeds_defaults(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/registers")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 3
        names = [i["name"] for i in items]
        for expected in ["Kassa 1", "Kassa 2", "Kassa 3"]:
            assert expected in names, f"Missing seed: {expected}"
        orders = [i["order"] for i in items]
        assert orders == sorted(orders), f"Not sorted by order: {orders}"
        for it in items:
            assert "id" in it and "name" in it and "color" in it and "order" in it

    def test_create_update_delete(self, base_url, api_client):
        # CREATE
        payload = {"name": "TEST_Kassa Extra", "description": "tmp", "color": "#123456"}
        r = api_client.post(f"{base_url}/api/registers", json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["name"] == payload["name"]
        assert created["color"] == "#123456"
        assert "id" in created
        assert isinstance(created["order"], int) and created["order"] >= 3
        rid = created["id"]

        # GET list -> contains it
        r = api_client.get(f"{base_url}/api/registers")
        assert any(b["id"] == rid for b in r.json())

        # UPDATE
        upd = {"name": "TEST_Renamed", "color": "#abcdef"}
        r = api_client.put(f"{base_url}/api/registers/{rid}", json=upd)
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["name"] == "TEST_Renamed"
        assert updated["color"] == "#abcdef"

        # GET to verify persistence
        r = api_client.get(f"{base_url}/api/registers")
        match = [b for b in r.json() if b["id"] == rid][0]
        assert match["name"] == "TEST_Renamed"
        assert match["color"] == "#abcdef"

        # DELETE
        r = api_client.delete(f"{base_url}/api/registers/{rid}")
        assert r.status_code == 200
        assert r.json().get("deleted") is True

        # Verify gone
        r = api_client.get(f"{base_url}/api/registers")
        assert all(b["id"] != rid for b in r.json())

    def test_update_nonexistent_returns_404(self, base_url, api_client):
        r = api_client.put(f"{base_url}/api/registers/non-existent-id", json={"name": "x"})
        assert r.status_code == 404

    def test_delete_nonexistent_returns_404(self, base_url, api_client):
        r = api_client.delete(f"{base_url}/api/registers/non-existent-id")
        assert r.status_code == 404


# --- AI Photo Counting ---
class TestCountPhoto:
    def test_count_photo_with_real_image(self, base_url, api_client):
        img_b64 = _make_real_jpeg_b64()
        body = {"image_base64": img_b64}
        r = api_client.post(f"{base_url}/api/count-photo", json=body, timeout=120)
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:500]}"
        data = r.json()
        assert "count" in data and "notes" in data
        assert isinstance(data["count"], int) and data["count"] >= 0
        assert isinstance(data["notes"], str)

    def test_count_photo_validation_missing_image(self, base_url, api_client):
        body = {"image_base64": ""}
        r = api_client.post(f"{base_url}/api/count-photo", json=body)
        assert r.status_code == 400


# --- Daily Counts CRUD ---
class TestDailyCounts:
    def test_create_list_get_delete(self, base_url, api_client):
        # Need at least one register
        r = api_client.get(f"{base_url}/api/registers")
        regs = r.json()
        assert len(regs) >= 1
        rid = regs[0]["id"]
        rname = regs[0]["name"]

        today = datetime.date.today().isoformat()
        payload = {
            "date": today,
            "register_id": rid,
            "count": 7,
            "note": "TEST_record",
        }
        r = api_client.post(f"{base_url}/api/daily-counts", json=payload)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["date"] == today
        assert rec["count"] == 7
        assert rec["register_id"] == rid
        assert rec["register_name"] == rname  # snapshot from registers
        assert rec["note"] == "TEST_record"
        assert "id" in rec
        rec_id = rec["id"]

        # LIST sorted by date desc
        r = api_client.get(f"{base_url}/api/daily-counts")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        dates = [i["date"] for i in items]
        assert dates == sorted(dates, reverse=True), f"Not sorted desc: {dates}"
        assert any(i["id"] == rec_id for i in items)

        # FILTER by register_id
        r = api_client.get(f"{base_url}/api/daily-counts", params={"register_id": rid})
        assert r.status_code == 200
        filtered = r.json()
        assert all(i["register_id"] == rid for i in filtered)
        assert any(i["id"] == rec_id for i in filtered)

        # FILTER by other register -> should not contain
        other = next((x for x in regs if x["id"] != rid), None)
        if other:
            r = api_client.get(f"{base_url}/api/daily-counts", params={"register_id": other["id"]})
            assert all(i["id"] != rec_id for i in r.json())

        # GET one
        r = api_client.get(f"{base_url}/api/daily-counts/{rec_id}")
        assert r.status_code == 200
        one = r.json()
        assert one["id"] == rec_id
        assert one["count"] == 7
        assert one["register_id"] == rid

        # DELETE
        r = api_client.delete(f"{base_url}/api/daily-counts/{rec_id}")
        assert r.status_code == 200
        assert r.json().get("deleted") is True

        # GET after delete -> 404
        r = api_client.get(f"{base_url}/api/daily-counts/{rec_id}")
        assert r.status_code == 404

    def test_create_with_invalid_register_returns_404(self, base_url, api_client):
        today = datetime.date.today().isoformat()
        payload = {
            "date": today,
            "register_id": "non-existent-id",
            "count": 5,
            "note": "",
        }
        r = api_client.post(f"{base_url}/api/daily-counts", json=payload)
        assert r.status_code == 404

    def test_get_nonexistent(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/daily-counts/does-not-exist")
        assert r.status_code == 404

    def test_delete_nonexistent(self, base_url, api_client):
        r = api_client.delete(f"{base_url}/api/daily-counts/does-not-exist")
        assert r.status_code == 404
