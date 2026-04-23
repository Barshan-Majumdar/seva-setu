# 🗄️ SevaSetu — Entity Relationship Diagram

## Visual Schema

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : "has members"
    USERS ||--o| VOLUNTEERS : "extends"
    USERS ||--o{ NEEDS : "reports"
    USERS ||--o{ TASKS : "assigned to"
    NEEDS ||--o{ TASKS : "fulfilled by"

    ORGANIZATIONS {
        uuid id PK
        string name
        string contact_email
        string district
        timestamp created_at
    }

    USERS {
        uuid id PK
        string name
        string email UK
        string password_hash
        enum role "coordinator | volunteer | field_worker"
        uuid org_id FK
        timestamp created_at
    }

    VOLUNTEERS {
        uuid user_id PK_FK
        text_array skills "medical, logistics, etc."
        point location "PostGIS POINT (SRID 4326)"
        boolean is_available
        int tasks_completed
        float completion_rate
    }

    NEEDS {
        uuid id PK
        string title
        text description
        enum need_type "medical | food | shelter | education | other"
        point location "PostGIS POINT (SRID 4326)"
        string ward
        string district
        int people_affected
        float urgency_score "1-10 scale"
        enum status "open | assigned | in_progress | completed"
        boolean is_disaster_zone
        uuid reported_by FK
        timestamp created_at
        timestamp updated_at
    }

    TASKS {
        uuid id PK
        uuid need_id FK
        uuid assigned_volunteer_id FK
        enum status "assigned | in_progress | completed"
        timestamp assigned_at
        timestamp checked_in_at
        timestamp completed_at
        text notes
    }
```

## Spatial Indexes

| Table | Column | Index Type | Purpose |
|---|---|---|---|
| `volunteers` | `location` | GIST | Fast geo-proximity queries for volunteer matching |
| `needs` | `location` | GIST | Heatmap rendering and distance calculations |

## Key Relationships

- **Users → Organizations**: Many-to-one (optional). A user belongs to one org.
- **Users → Volunteers**: One-to-one extension. Only users with `role = 'volunteer'` get a volunteers row.
- **Users → Needs**: One-to-many. Field workers / coordinators report needs.
- **Needs → Tasks**: One-to-many. A need can have multiple task assignments over time.
- **Users → Tasks**: One-to-many. A volunteer can be assigned to multiple tasks.

## PostGIS Usage

All location columns use **SRID 4326** (WGS 84 — standard GPS coordinates).

Key spatial functions used:
- `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` — create a point from coordinates
- `ST_Distance(a::geography, b::geography)` — distance in meters between two points
- GIST indexes enable fast nearest-neighbor queries for volunteer matching
