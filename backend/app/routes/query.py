"""
Query management routes: persistent storage for search queries and presets.
"""
import os
import json
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import SLIDES_DIR

router = APIRouter(tags=["Queries"])

# JSON storage path - store in a 'data' subdirectory next to SLIDES_DIR
# Fallback to app directory if SLIDES_DIR parent is empty/root
_slides_parent = os.path.dirname(os.path.abspath(SLIDES_DIR))
if not _slides_parent or _slides_parent == "/" or _slides_parent == "\\":
    _slides_parent = os.path.dirname(os.path.abspath(__file__))
QUERIES_FILE = os.path.join(_slides_parent, "queries.json")


class QueryPreset(BaseModel):
    id: str
    label: str
    terms: List[str]  # Single term = ["term"], Intersection = ["term1", "term2", ...]
    is_intersection: bool = False


class QueriesData(BaseModel):
    common_queries: List[str] = []
    intersection_presets: List[QueryPreset] = []


def load_queries() -> dict:
    """Load queries from JSON file, create default if not exists."""
    if not os.path.exists(QUERIES_FILE):

        return {}
    
    with open(QUERIES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_queries(data: dict):
    """Save queries to JSON file."""
    dir_path = os.path.dirname(QUERIES_FILE)
    if dir_path:  # Only create if there's actually a directory path
        os.makedirs(dir_path, exist_ok=True)
    with open(QUERIES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


@router.get("/queries")
def get_queries():
    """Get all query presets."""
    return load_queries()


@router.post("/queries/common")
def add_common_query(query: str):
    """Add a new common query."""
    data = load_queries()
    if query not in data["common_queries"]:
        data["common_queries"].append(query)
        save_queries(data)
    return {"status": "ok", "common_queries": data["common_queries"]}


@router.delete("/queries/common/{query:path}")
def delete_common_query(query: str):
    """Delete a common query."""
    data = load_queries()
    if query in data["common_queries"]:
        data["common_queries"].remove(query)
        save_queries(data)
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Query not found")


@router.post("/queries/preset")
def add_intersection_preset(preset: QueryPreset):
    """Add a new intersection preset."""
    data = load_queries()
    
    # Check if ID already exists
    existing_ids = [p["id"] for p in data["intersection_presets"]]
    if preset.id in existing_ids:
        raise HTTPException(status_code=400, detail="Preset ID already exists")
    
    data["intersection_presets"].append(preset.model_dump())
    save_queries(data)
    return {"status": "ok", "preset": preset}


@router.put("/queries/preset/{preset_id}")
def update_intersection_preset(preset_id: str, preset: QueryPreset):
    """Update an existing intersection preset."""
    data = load_queries()
    
    for i, p in enumerate(data["intersection_presets"]):
        if p["id"] == preset_id:
            data["intersection_presets"][i] = preset.model_dump()
            save_queries(data)
            return {"status": "ok", "preset": preset}
    
    raise HTTPException(status_code=404, detail="Preset not found")


@router.delete("/queries/preset/{preset_id}")
def delete_intersection_preset(preset_id: str):
    """Delete an intersection preset."""
    data = load_queries()
    
    original_len = len(data["intersection_presets"])
    data["intersection_presets"] = [p for p in data["intersection_presets"] if p["id"] != preset_id]
    
    if len(data["intersection_presets"]) < original_len:
        save_queries(data)
        return {"status": "ok"}
    
    raise HTTPException(status_code=404, detail="Preset not found")
