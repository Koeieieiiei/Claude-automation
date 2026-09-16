import type { CourseStat } from "@/lib/courses";

/** ไอคอนสถิติบนหน้ารายละเอียดคอร์ส (เส้นบาง สีเดียว) */
export default function CourseIcon({ kind, className = "h-9 w-9" }: { kind: CourseStat["icon"]; className?: string }) {
  const common = {
    className,
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (kind) {
    case "questions":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="1.5" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      );
    case "pages":
      return (
        <svg {...common}>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v4h4M9 12h6M9 16h6" />
        </svg>
      );
    case "chapters":
      return (
        <svg {...common}>
          <path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z" />
        </svg>
      );
    case "infinity":
      return (
        <svg {...common}>
          <path d="M8.5 15.5c-2 0-3.5-1.6-3.5-3.5s1.5-3.5 3.5-3.5c2.8 0 4.2 7 7 7 2 0 3.5-1.6 3.5-3.5S17.5 8.5 15.5 8.5c-2.8 0-4.2 7-7 7z" />
        </svg>
      );
    case "exam":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="1.5" />
          <path d="M8 9l2 2 3-3M8 15l2 2 3-3M15 9h2M15 15h2" />
        </svg>
      );
  }
}
