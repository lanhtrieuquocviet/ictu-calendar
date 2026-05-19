UPDATE events
SET "approvedByName" = 'Test Approver',
    "approvedAt" = NOW()
WHERE id = (SELECT id FROM events WHERE status = 'approved' ORDER BY "createdAt" DESC LIMIT 1);

SELECT title, status, "approvedByName", "approvedAt" FROM events WHERE "approvedByName" IS NOT NULL;
