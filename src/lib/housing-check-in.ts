export async function checkInHousingBookings(
  bookings: Array<{ id: string; bookingNo?: string }>,
  update: (id: string) => any,
) {
  const results = await Promise.all(bookings.map(async (booking) => {
    try {
      const response = await update(booking.id);
      if (response?.ok && response.result?.status === "CHECKED_IN") return { success: true, message: "" };
      return { success: false, message: `${booking.bookingNo || booking.id}: ${response?.result?.message || "Check-in was not confirmed. Refresh and retry."}` };
    } catch (error) {
      return { success: false, message: `${booking.bookingNo || booking.id}: ${error instanceof Error ? error.message : "Unable to check in. Please retry."}` };
    }
  }));
  const succeeded = results.filter((result) => result.success).length;
  const failures = results.filter((result) => !result.success).map((result) => result.message);
  return `${succeeded} of ${bookings.length} booking(s) checked in.${failures.length ? `\n\nCheck-in failed:\n${failures.join("\n")}` : ""}`;
}
