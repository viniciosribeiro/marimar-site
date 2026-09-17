"use client";

export function IconPicker({ name, defaultValue = "check" }: { name: string; defaultValue?: string }) {
  const icons = [
    "wind", "wifi", "tv", "refrigerator", "utensils", "coffee", "bath", "baby",
    "paw-print", "car", "map", "clock", "tree-pine", "hammock", "waves",
    "binoculars", "sun", "check", "star", "heart", "shield", "globe", "anchor",
  ];
  return (
    <select name={name} defaultValue={defaultValue} className="w-full border rounded p-2 text-sm">
      {icons.map((i) => (
        <option key={i} value={i}>{i}</option>
      ))}
    </select>
  );
}