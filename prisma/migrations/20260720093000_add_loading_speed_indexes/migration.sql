-- Speed up large CAFM table loads, filtered dropdowns, and PPM planner sorting.
CREATE INDEX IF NOT EXISTS "ppm_plans_next_due_idx" ON "PreventiveMaintenance"("nextDue");
CREATE INDEX IF NOT EXISTS "ppm_plans_active_next_due_idx" ON "PreventiveMaintenance"("active", "nextDue");
CREATE INDEX IF NOT EXISTS "ppm_plans_department_next_due_idx" ON "PreventiveMaintenance"("departmentCode", "nextDue");
CREATE INDEX IF NOT EXISTS "ppm_plans_location_next_due_idx" ON "PreventiveMaintenance"("locationCode", "nextDue");
CREATE INDEX IF NOT EXISTS "service_requests_created_at_idx" ON "ServiceRequest"("createdAt");
CREATE INDEX IF NOT EXISTS "service_requests_updated_at_idx" ON "ServiceRequest"("updatedAt");
CREATE INDEX IF NOT EXISTS "work_orders_created_at_idx" ON "WorkOrder"("createdAt");
CREATE INDEX IF NOT EXISTS "work_orders_updated_at_idx" ON "WorkOrder"("updatedAt");
CREATE INDEX IF NOT EXISTS "locations_code_created_at_idx" ON "Location"("code", "createdAt");
CREATE INDEX IF NOT EXISTS "housing_rooms_status_room_number_idx" ON "HousingRoom"("status", "roomNumber");
CREATE INDEX IF NOT EXISTS "housing_residents_name_idx" ON "HousingResident"("name");
CREATE INDEX IF NOT EXISTS "housing_residents_employee_lookup_idx" ON "HousingResident"("residentNo", "name");
CREATE INDEX IF NOT EXISTS "housing_bookings_checkin_status_idx" ON "HousingBooking"("checkIn", "status");
CREATE INDEX IF NOT EXISTS "housing_bookings_checkout_status_idx" ON "HousingBooking"("checkOut", "status");
CREATE INDEX IF NOT EXISTS "housing_bookings_employee_idx" ON "HousingBooking"("employeeId");
CREATE INDEX IF NOT EXISTS "ppm_checklist_history_created_at_idx" ON "PpmChecklistHistory"("createdAt");
CREATE INDEX IF NOT EXISTS "comment_history_created_at_idx" ON "CommentHistory"("createdAt");
