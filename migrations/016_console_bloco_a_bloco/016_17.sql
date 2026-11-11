CREATE TABLE IF NOT EXISTS agv23_document_attachments (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL REFERENCES organizations(id),
 farm_id TEXT NOT NULL REFERENCES farms(id),
 entity_type TEXT NOT NULL,
 entity_id TEXT NOT NULL REFERENCES erp_records(id),
 doc_type TEXT NOT NULL CHECK(doc_type IN ('NFE','CTE','GTA','OUTRO')),
 file_name TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 size_bytes INTEGER NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 250000),
 content_base64 TEXT NOT NULL,
 uploaded_by TEXT NOT NULL REFERENCES app_users(id),
 uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
