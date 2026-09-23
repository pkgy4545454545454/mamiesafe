"""MamieSafe iteration-2 backend tests: config extension, activities + scheduler, photo-requests."""
import io
import os
import time
import uuid
import pytest
import requests

BASE = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL") or "").rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- config extension: sound_detection + mamie_phone ---------------------
def test_config_has_new_fields(client):
    r = client.get(f"{API}/config")
    assert r.status_code == 200
    d = r.json()
    assert "sound_detection" in d and isinstance(d["sound_detection"], bool)
    assert "mamie_phone" in d and isinstance(d["mamie_phone"], str)


def test_config_put_persists_new_fields(client):
    phone = "06 " + uuid.uuid4().hex[:8]
    r = client.put(f"{API}/config", json={"sound_detection": True, "mamie_phone": phone})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["sound_detection"] is True
    assert d["mamie_phone"] == phone

    g = client.get(f"{API}/config").json()
    assert g["sound_detection"] is True
    assert g["mamie_phone"] == phone

    # toggle back off, keep phone reasonable
    r2 = client.put(f"{API}/config", json={"sound_detection": False, "mamie_phone": ""})
    assert r2.status_code == 200
    assert r2.json()["sound_detection"] is False


# ---- activities CRUD ------------------------------------------------------
def _iso_offset(seconds: int) -> str:
    from datetime import datetime, timedelta, timezone
    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()


def test_activity_create_list(client):
    payload = {
        "title": "TEST_Piscine",
        "kind": "activity",
        "start_at": _iso_offset(60),
        "end_at": _iso_offset(3600),
        "grace_minutes": 10,
    }
    r = client.post(f"{API}/activities", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["id"]
    assert d["title"] == "TEST_Piscine"
    assert d["status"] == "scheduled"

    lst = client.get(f"{API}/activities").json()
    assert any(a["id"] == d["id"] for a in lst)


def test_activity_confirm(client):
    r = client.post(f"{API}/activities", json={
        "title": "TEST_Confirm", "kind": "shower",
        "start_at": _iso_offset(-60), "end_at": _iso_offset(60), "grace_minutes": 10,
    })
    aid = r.json()["id"]
    r2 = client.patch(f"{API}/activities/{aid}", json={"status": "confirmed"})
    assert r2.status_code == 200, r2.text
    d = r2.json()
    assert d["status"] == "confirmed"
    assert d["confirmed_at"]


def test_activity_cancel(client):
    r = client.post(f"{API}/activities", json={
        "title": "TEST_Cancel", "kind": "activity",
        "start_at": _iso_offset(60), "end_at": _iso_offset(3600), "grace_minutes": 10,
    })
    aid = r.json()["id"]
    r2 = client.patch(f"{API}/activities/{aid}", json={"status": "cancelled"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "cancelled"


def test_activity_404(client):
    r = client.patch(f"{API}/activities/does-not-exist", json={"status": "confirmed"})
    assert r.status_code == 404


# ---- scheduler: scheduled -> awaiting_confirmation -----------------------
def test_scheduler_flips_to_awaiting(client):
    """Create an activity ending 40s in the past with a large grace so it flips to awaiting."""
    r = client.post(f"{API}/activities", json={
        "title": f"TEST_Await_{uuid.uuid4().hex[:5]}",
        "kind": "activity",
        "start_at": _iso_offset(-200),
        "end_at": _iso_offset(-40),
        "grace_minutes": 999,
    })
    assert r.status_code == 200, r.text
    aid = r.json()["id"]

    # scheduler runs every 30s; wait up to 45s
    found = False
    deadline = time.time() + 45
    while time.time() < deadline:
        awaiting = client.get(f"{API}/activities?status=awaiting_confirmation").json()
        if any(a["id"] == aid for a in awaiting):
            found = True
            break
        time.sleep(3)
    assert found, "Activity did not flip to awaiting_confirmation within 45s"

    # cleanup
    client.patch(f"{API}/activities/{aid}", json={"status": "cancelled"})


# ---- photo requests -------------------------------------------------------
def test_photo_request_create_and_refuse(client):
    r = client.post(f"{API}/photo-requests")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "pending"
    pid = d["id"]

    lst = client.get(f"{API}/photo-requests").json()
    assert any(p["id"] == pid for p in lst)

    r2 = client.patch(f"{API}/photo-requests/{pid}", json={"status": "refused"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "refused"


def test_photo_request_404(client):
    r = client.patch(f"{API}/photo-requests/does-not-exist", json={"status": "refused"})
    assert r.status_code == 404


def test_photo_upload_and_fetch(client):
    r = client.post(f"{API}/photo-requests")
    pid = r.json()["id"]

    # 1x1 PNG
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0"
        b"\x00\x00\x00\x03\x00\x01\x5c\xcd\xff\x69\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    files = {"file": ("test.png", io.BytesIO(png), "image/png")}
    # use a plain requests call (multipart, no default content-type header)
    r2 = requests.post(f"{API}/photo-requests/{pid}/photo", files=files, timeout=60)
    assert r2.status_code == 200, r2.text
    d = r2.json()
    assert d["status"] == "fulfilled"
    assert d["photo_path"]
    assert d["fulfilled_at"]

    r3 = requests.get(f"{API}/photos/{pid}", timeout=30)
    assert r3.status_code == 200, r3.text
    assert r3.headers.get("Content-Type", "").startswith("image/")
    assert len(r3.content) > 0
