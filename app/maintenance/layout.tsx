export default function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Return children directly without header/footer (like 404 page)
  return children;
}
