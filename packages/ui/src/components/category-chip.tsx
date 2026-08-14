/**
 * Categorical taxonomy chip (subject, program, role family).
 * Never reuse status SoftTones for taxonomy — that is the Wave 4A contract.
 */
export type CategoryId = 'a' | 'b' | 'c' | 'd';

export interface CategoryChipProps {
  category: CategoryId;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CategoryChip({ category, label, size = 'md' }: CategoryChipProps) {
  const sizeClass = size === 'md' ? '' : ` console-category-chip--${size}`;
  return (
    <span
      className={`console-category-chip console-category-chip--${category}${sizeClass}`}
      data-category={category}
    >
      {label}
    </span>
  );
}
