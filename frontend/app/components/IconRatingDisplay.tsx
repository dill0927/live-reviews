"use client";

import { ReactNode } from "react";

export default function IconRatingDisplay({
  rating,
  icon,
  size = "text-xl",
  fullColor = "text-overall",
  halfColor = "text-overall opacity-70",
  emptyColor = "text-empty",
}: {
  rating: number;
  icon: ReactNode;
  size?: string;
  fullColor?: string;
  halfColor?: string;
  emptyColor?: string;
}) {
  const isValidRating =
    typeof rating === "number" && !isNaN(rating) && rating > 0;
  const safeRating = isValidRating ? rating : 0;

  const max = 5;
  const full = Math.floor(safeRating);
  const half = safeRating % 1 >= 0.5;
  const empty = max - full - (half ? 1 : 0);

  return (
    <div className="flex items-center space-x-5">
      <div className="flex items-center space-x-1">
        {isValidRating ? (
          <>
            {Array.from({ length: full }).map((_, i) => (
              <span key={`full-${i}`} className={`${size} ${fullColor}`}>
                {icon}
              </span>
            ))}
            {half && <span className={`${size} ${halfColor}`}>{icon}</span>}
            {Array.from({ length: empty }).map((_, i) => (
              <span key={`empty-${i}`} className={`${size} ${emptyColor}`}>
                {icon}
              </span>
            ))}
          </>
        ) : (
          Array.from({ length: 5 }).map((_, i) => (
            <span key={`empty-${i}`} className={`${size} ${emptyColor}`}>
              {icon}
            </span>
          ))
        )}
      </div>
      {isValidRating && (
        <span className="text-gray-600 text-sm">{safeRating.toFixed(1)}</span>
      )}
    </div>
  );
}
