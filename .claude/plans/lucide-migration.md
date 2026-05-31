# Plan: Replace Material Symbols with Lucide Icons

## Scope
- 19 files, ~65 unique icon names
- DB stored icon names: Goal.icon, CreditRule.icon, Report.data highlights/achievements
- 2 places use FILL variation (liked state, active nav)

## Approach

### 1. Icon component (`src/components/icon.tsx`)
```tsx
<Icon name="arrow_back" className="text-xl" filled={true} />
```
- Maps Material Symbols names → Lucide component names
- Supports className pass-through for sizing/color
- `filled` prop for solid variants (lucide uses `fill="currentColor"`)

### 2. Mapping table (`src/lib/icon-map.ts`)
- Maps all 65 Material Symbols names to their Lucide equivalents
- Used by both the Icon component and for runtime DB value conversion
- Fallback: show a generic icon if no mapping exists

### 3. Replacement strategy
- Replace all `<span className="material-symbols-outlined">xxx</span>` → `<Icon name="xxx" />`
- Replace `{variable}` dynamic icons with `<Icon name={variable} />`
- Handle FILL state → `filled` prop

### 4. DB migration
- No schema change needed (still stores string icon names)
- Update seed data to use lucide icon names directly
- Report generator LLM prompt updated to output lucide icon names

### 5. Cleanup
- Remove Material Symbols font link from layout.tsx
- Remove `material-symbols-outlined` CSS references
