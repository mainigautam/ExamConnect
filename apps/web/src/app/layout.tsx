import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExamConnect — Government Exam Eligibility & Recruitment Platform",
  description:
    "Verify your eligibility across Indian government recruitment examinations, track official notification PDFs, application deadlines, and category-wise criteria.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
