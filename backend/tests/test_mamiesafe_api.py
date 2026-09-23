"""MamieSafe backend API tests - covers config, events, alerts, location, heartbeat, summary."""
import os
import time
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if BASE:
    BASE = BASE.rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- root & config -------------------------------------------------------
def test_root(client):
    r = client.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_get_config_defaults(client):
    r = client.get(f"{API}/config")
    assert r.status_code == 200
    d = r.json()
    # If DB already had modifications, still assert keys exist and reasonable defaults
    assert "mamie_name" in d and isinstance(d["mamie_name"], str)
    assert d["emergency_number"]  # non-empty
    assert d["dashboard_pin"]
    assert d["fall_sensitivity"] in ("basse", "moyenne", "haute")
    assert isinstance(d["checkin_interval_hours"], int)
    assert isinstance(d["contacts"], list)


def test_put_config_persists(client):
    tag = f"TEST_{uuid.uuid4().hex[:6]}"
    payload = {
        "mamie_name": tag,
        "emergency_number": "112",
        "fall_sensitivity": "haute",
        "checkin_interval_hours": 6,
        "dashboard_pin": "1234",
        "contacts": [{"name": "TEST_Voisine", "phone": "0102030405", "primary": True}],
    }
    r = client.put(f"{API}/config", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["mamie_name"] == tag
    assert d["fall_sensitivity"] == "haute"
    assert d["checkin_interval_hours"] == 6
    assert len(d["contacts"]) == 1
    assert d["contacts"][0]["name"] == "TEST_Voisine"
    # GET verify persistence
    g = client.get(f"{API}/config").json()
    assert g["mamie_name"] == tag
    assert g["fall_sensitivity"] == "haute"
    assert g["contacts"][0]["phone"] == "0102030405"
    # restore friendlier defaults
    client.put(
        f"{API}/config",
        json={"mamie_name": "Mamie", "fall_sensitivity": "moyenne", "checkin_interval_hours": 4, "contacts": []},
    )


# ---- events --------------------------------------------------------------
@pytest.mark.parametrize("etype", ["bedtime", "checkin", "sos", "fall"])
def test_create_event(client, etype):
    r = client.post(f"{API}/events", json={"type": etype, "note": f"TEST_{etype}"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["type"] == etype
    assert d["id"]
    assert d["created_at"]


def test_events_newest_first(client):
    r = client.get(f"{API}/events?limit=20")
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 4
    dates = [i["created_at"] for i in items]
    assert dates == sorted(dates, reverse=True)


# ---- alerts --------------------------------------------------------------
@pytest.fixture(scope="module")
def created_alert(client):
    r = client.post(
        f"{API}/alerts",
        json={"kind": "sos", "severity": "dangereux", "message": "TEST_alert"},
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_create_alert_fields(created_alert):
    assert created_alert["kind"] == "sos"
    assert created_alert["severity"] == "dangereux"
    assert created_alert["status"] == "pending"


def test_get_alerts_contains(client, created_alert):
    r = client.get(f"{API}/alerts")
    assert r.status_code == 200
    ids = [a["id"] for a in r.json()]
    assert created_alert["id"] in ids


def test_patch_alert_validate(client, created_alert):
    r = client.patch(f"{API}/alerts/{created_alert['id']}", json={"status": "validated"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "validated"
    assert d["resolved_at"]


def test_patch_alert_dismiss(client):
    a = client.post(f"{API}/alerts", json={"kind": "fall", "severity": "moyen", "message": "TEST_dismiss"}).json()
    r = client.patch(f"{API}/alerts/{a['id']}", json={"status": "dismissed"})
    assert r.status_code == 200
    assert r.json()["status"] == "dismissed"


def test_patch_alert_404(client):
    r = client.patch(f"{API}/alerts/does-not-exist", json={"status": "validated"})
    assert r.status_code == 404


# ---- location ------------------------------------------------------------
def test_location_post_and_latest(client):
    lat, lng = 48.8566, 2.3522
    r = client.post(f"{API}/location", json={"lat": lat, "lng": lng, "accuracy": 10.0})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["lat"] == lat and d["lng"] == lng
    time.sleep(0.1)
    r2 = client.get(f"{API}/location/latest")
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["lat"] == lat and d2["lng"] == lng


# ---- heartbeat & status --------------------------------------------------
def test_heartbeat_and_status(client):
    r = client.post(f"{API}/heartbeat", json={"battery": 55.0, "fall_active": True, "listening": False})
    assert r.status_code == 200, r.text
    r2 = client.get(f"{API}/status")
    assert r2.status_code == 200
    d = r2.json()
    assert d["online"] is True
    assert d["fall_active"] is True
    assert d["battery"] == 55.0


# ---- summary -------------------------------------------------------------
def test_dashboard_summary(client):
    r = client.get(f"{API}/dashboard/summary")
    assert r.status_code == 200, r.text
    d = r.json()
    for key in ("mamie_name", "last_checkin", "last_bedtime", "pending_alerts", "last_location", "status"):
        assert key in d
    assert isinstance(d["pending_alerts"], int)
    # We created bedtime+checkin above
    assert d["last_bedtime"] is not None
    assert d["last_checkin"] is not None
    assert d["status"].get("online") is True
