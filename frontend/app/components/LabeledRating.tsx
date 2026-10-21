import IconRatingDisplay from "./IconRatingDisplay";
import { ReactNode } from "react";

export default function LabeledRating({
  label,
  rating,
  icon,
  fullColor = "text-overall",
  halfColor = "text-overall opacity-70",
  emptyColor = "text-empty",
}: {
  label: string;
  rating: number;
  icon: ReactNode;
  fullColor?: string;
  halfColor?: string;
  emptyColor?: string;
}) {
  return (
    <div className="flex items-center space-x-3">
      <span className="w-20 font-semibold">{label}</span>
      <IconRatingDisplay
        rating={rating}
        icon={icon}
        fullColor={fullColor}
        halfColor={halfColor}
        emptyColor={emptyColor}
      />
    </div>
  );
}
