"""Backend tests for Påsräknaren API."""
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
    # background texture
    for x in range(0, 640, 20):
        d.line([(x, 0), (x, 480)], fill=(230, 215, 195), width=1)
    # Three "stacks" of bags in compartments
    palettes = [(212, 163, 115), (168, 131, 88), (224, 201, 166)]
    for i, color in enumerate(palettes):
        x0 = 30 + i * 200
        # compartment outline
        d.rectangle([x0, 60, x0 + 160, 420], outline=(80, 60, 40), width=3)
        # 5 stacked bag rectangles per compartment
        for j in range(5):
            y = 80 + j * 60
            d.rectangle([x0 + 15, y, x0 + 145, y + 50], fill=color, outline=(60, 40, 20), width=2)
            d.line([(x0 + 30, y), (x0 + 30, y + 50)], fill=(60, 40, 20), width=1)
            d.line([(x0 + 130, y), (x0 + 130, y + 50)], fill=(60, 40, 20), width=1)
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


# --- Bag Types CRUD ---
class TestBagTypes:
    def test_list_seeds_defaults(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/bag-types")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 3
        names = [i["name"] for i in items]
        # Default seeds
        for expected in ["Liten påse", "Mellan påse", "Stor påse"]:
            assert expected in names, f"Missing seed: {expected}"
        # Sorted by order asc
        orders = [i["order"] for i in items]
        assert orders == sorted(orders), f"Not sorted by order: {orders}"
        # Each item has required fields
        for it in items:
            assert "id" in it and "name" in it and "color" in it and "order" in it

    def test_create_update_delete(self, base_url, api_client):
        # CREATE
        payload = {"name": "TEST_Extra påse", "description": "tmp", "color": "#123456"}
        r = api_client.post(f"{base_url}/api/bag-types", json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["name"] == payload["name"]
        assert created["color"] == "#123456"
        assert "id" in created
        # order auto-incremented (>= 3 since defaults occupy 0..2)
        assert isinstance(created["order"], int) and created["order"] >= 3
        type_id = created["id"]

        # GET list -> contains it
        r = api_client.get(f"{base_url}/api/bag-types")
        assert any(b["id"] == type_id for b in r.json())

        # UPDATE
        upd = {"name": "TEST_Renamed", "color": "#abcdef"}
        r = api_client.put(f"{base_url}/api/bag-types/{type_id}", json=upd)
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["name"] == "TEST_Renamed"
        assert updated["color"] == "#abcdef"

        # GET to verify persistence
        r = api_client.get(f"{base_url}/api/bag-types")
        match = [b for b in r.json() if b["id"] == type_id][0]
        assert match["name"] == "TEST_Renamed"
        assert match["color"] == "#abcdef"

        # DELETE
        r = api_client.delete(f"{base_url}/api/bag-types/{type_id}")
        assert r.status_code == 200
        assert r.json().get("deleted") is True

        # Verify gone
        r = api_client.get(f"{base_url}/api/bag-types")
        assert all(b["id"] != type_id for b in r.json())

    def test_update_nonexistent_returns_404(self, base_url, api_client):
        r = api_client.put(f"{base_url}/api/bag-types/non-existent-id", json={"name": "x"})
        assert r.status_code == 404

    def test_delete_nonexistent_returns_404(self, base_url, api_client):
        r = api_client.delete(f"{base_url}/api/bag-types/non-existent-id")
        assert r.status_code == 404


# --- AI Photo Counting ---
class TestCountPhoto:
    def test_count_photo_with_real_image(self, base_url, api_client):
        # get bag types
        r = api_client.get(f"{base_url}/api/bag-types")
        assert r.status_code == 200
        bag_types = r.json()[:3]
        bag_types_payload = [
            {"id": b["id"], "name": b["name"], "description": b.get("description", "")}
            for b in bag_types
        ]
        img_b64 = _make_real_jpeg_b64()
        body = {"image_base64": img_b64, "bag_types": bag_types_payload}
        r = api_client.post(f"{base_url}/api/count-photo", json=body, timeout=120)
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:500]}"
        data = r.json()
        assert "counts" in data and "notes" in data
        counts = data["counts"]
        assert isinstance(counts, dict)
        # All input ids present
        for b in bag_types_payload:
            assert b["id"] in counts, f"Missing id {b['id']} in counts"
            v = counts[b["id"]]
            assert isinstance(v, int) and v >= 0, f"Bad count {v} for {b['id']}"
        assert isinstance(data["notes"], str)

    def test_count_photo_validation_missing_image(self, base_url, api_client):
        body = {"image_base64": "", "bag_types": [{"id": "x", "name": "y", "description": ""}]}
        r = api_client.post(f"{base_url}/api/count-photo", json=body)
        assert r.status_code == 400

    def test_count_photo_validation_missing_types(self, base_url, api_client):
        body = {"image_base64": "abc", "bag_types": []}
        r = api_client.post(f"{base_url}/api/count-photo", json=body)
        assert r.status_code == 400


# --- Daily Counts CRUD ---
class TestDailyCounts:
    def test_create_list_get_delete(self, base_url, api_client):
        # Need at least one bag type
        r = api_client.get(f"{base_url}/api/bag-types")
        bag_types = r.json()
        assert len(bag_types) >= 1
        bid = bag_types[0]["id"]

        today = datetime.date.today().isoformat()
        payload = {
            "date": today,
            "counts": {bid: 7},
            "note": "TEST_record",
        }
        r = api_client.post(f"{base_url}/api/daily-counts", json=payload)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["date"] == today
        assert rec["counts"][bid] == 7
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

        # GET one
        r = api_client.get(f"{base_url}/api/daily-counts/{rec_id}")
        assert r.status_code == 200
        one = r.json()
        assert one["id"] == rec_id
        assert one["counts"][bid] == 7

        # DELETE
        r = api_client.delete(f"{base_url}/api/daily-counts/{rec_id}")
        assert r.status_code == 200
        assert r.json().get("deleted") is True

        # GET after delete -> 404
        r = api_client.get(f"{base_url}/api/daily-counts/{rec_id}")
        assert r.status_code == 404

    def test_get_nonexistent(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/daily-counts/does-not-exist")
        assert r.status_code == 404

    def test_delete_nonexistent(self, base_url, api_client):
        r = api_client.delete(f"{base_url}/api/daily-counts/does-not-exist")
        assert r.status_code == 404
