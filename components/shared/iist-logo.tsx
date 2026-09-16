import Image from "next/image";
import { cn } from "@/lib/utils";

interface IISTLogoProps {
  /** Square size in pixels for both width and height. Default 40. */
  size?: number;
  className?: string;
}

/**
 * The official IIST (Indore Institute of Science and Technology) emblem —
 * the actual college logo asset (public/iist-logo.jpg), never redrawn or
 * substituted. Single source used everywhere the mark appears (login,
 * sidebar, mobile header) so there's exactly one place to update the file
 * or its sizing.
 */
export function IISTLogo({ size = 40, className }: IISTLogoProps) {
  return (
    <Image
      src="/iist-logo.jpg"
      alt="Indore Institute of Science and Technology logo"
      width={size}
      height={size}
      priority
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
