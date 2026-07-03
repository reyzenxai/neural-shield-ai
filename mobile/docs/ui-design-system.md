# Neural Shield AI — UI Design System

## Color System

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#060B16` | App background |
| `surface` | `#0D1420` | Input fields, inner surfaces |
| `card` | `#111827` | Cards, modals, bottom sheets |
| `cardElevated` | `#141E2E` | Elevated/floating cards |
| `border` | `rgba(255,255,255,0.07)` | Default card borders |
| `borderStrong` | `rgba(255,255,255,0.14)` | Focus/active borders |
| `primary` | `#4F7CFF` | Primary actions, links, active states |
| `secondary` | `#7C5CFF` | Gradient end, secondary accents |
| `accent` | `#00D9A6` | Success indicators, completed steps |
| `danger` | `#FF4D6D` | Critical risk, error states |
| `warning` | `#FFB020` | Medium/suspicious risk |
| `success` | `#22C55E` | Safe results |

### Risk Color Mapping
- **Safe** → `#22C55E` (green)
- **Low / Suspicious** → `#FFB020` (amber)
- **Medium / Dangerous** → `#FF7A2F` (orange)
- **High / Critical** → `#FF4D6D` (red)

---

## Typography

```
Hero Title:      28–32px  weight:800  letterSpacing:-0.6
Section Title:   22px     weight:800  letterSpacing:-0.4
Card Title:      16–18px  weight:700
Body:            13–15px  weight:400–600  lineHeight:22
Caption:         11–12px  weight:600  color:textMuted
Label/Tag:       10–11px  weight:700  UPPERCASE  letterSpacing:0.6
```

---

## Spacing & Radius

| Context | Value |
|---------|-------|
| Screen padding | 20px horizontal |
| Card radius | 18–20dp |
| Button radius | 14dp |
| Badge radius | 999 (pill) |
| Icon container | 12–13dp |
| Card gap | 10–14px |

---

## Elevation

```
Cards:      shadowColor:#000  offset:(0,8)  opacity:0.3  radius:16  elevation:8
Elevated:   shadowColor:#000  offset:(0,12) opacity:0.4  radius:24  elevation:12
Dialogs:    shadowColor:#000  offset:(0,20) opacity:0.4  radius:32  elevation:20
Glow ring:  shadowColor:<riskColor>  offset:(0,0)  opacity:0.65  radius:18  elevation:20
```

---

## Animation Guidelines

All animations use React Native's `Animated` API with `useNativeDriver: true` for transforms and opacity.

### Entrance Animations
```
fadeIn:  Animated.timing  duration:320–480ms  easing:default
slideUp: Animated.spring  tension:60  friction:9
scale:   Animated.spring  tension:55  friction:8  from:0.75→1
```

### Staggered List Cards
- Delay: `Math.min(index * 55, 280)ms`
- Each card: fade + spring slide-up

### Interactive Feedback
```
Button press:  scale 1→0.965  spring speed:40 bounciness:0
Button release: scale 0.965→1 spring speed:20 bounciness:4
```

### Pulsing Glow (ThreatMeter)
```
Animated.loop: opacity 0.25→0.85→0.25  duration:2200ms each direction
```

### Count-up Animation (ThreatMeter)
```
Duration: 1400ms  easing: cubic ease-out  interval:16ms
```

---

## Component Library

### `GlassCard`
```tsx
<GlassCard variant="default" | "elevated" | "accent" | "danger" padding={16}>
  {children}
</GlassCard>
```

### `GradientButton`
```tsx
<GradientButton
  title="Scan Now"
  variant="primary" | "secondary" | "danger" | "success" | "ghost"
  size="sm" | "md" | "lg"
  icon="🔍"
  loading={false}
  disabled={false}
  onPress={fn}
/>
```
Gradient: `primary` → `["#4F7CFF", "#7C5CFF"]`

### `ThreatMeter`
```tsx
<ThreatMeter
  value={85}          // 0–100
  color={colors.danger}
  label="scam risk"
  size={164}
/>
```
Features: animated count-up, pulsing glow ring, spring entrance.

### `ScannerProgress`
```tsx
<ScannerProgress visible={loading} />
```
Full-screen overlay with 6 animated analysis steps. Must be positioned after ScrollView as an absolute element.

### `RiskBadge`
```tsx
<RiskBadge level="critical" | "high" | "medium" | "low" | "safe" size="sm" | "md" | "lg" />
```

---

## Glassmorphism Rules

1. **Background**: `colors.card` (`#111827`) — never pure black
2. **Border**: `rgba(255,255,255,0.07)` default, `rgba(255,255,255,0.14)` on hover/active
3. **Shadow**: Always `shadowColor: "#000"` — never colored shadows except for glow effects
4. **Glow exception**: Risk-colored shadows on ThreatMeter ring only
5. **Blur**: React Native doesn't support CSS blur natively — simulate with layered semi-transparent views

---

## Gradient Rules

| Use case | Colors |
|----------|--------|
| Primary button | `["#4F7CFF", "#7C5CFF"]` left→right |
| Active tab | `["rgba(79,124,255,0.22)", "rgba(124,92,255,0.18)"]` |
| Safe result | `["#22C55E", "#15803D"]` |
| Critical result | `["#FF4D6D", "#BE123C"]` |
| Medium result | `["#FF7A2F", "#EA580C"]` |
| Low result | `["#FFB020", "#D97706"]` |
| Quota bar (normal) | `["#4F7CFF", "#7C5CFF"]` |
| Quota bar (warning) | `["#FFB020", "#D97706"]` |
| Quota bar (full) | `["#FF4D6D", "#CC2244"]` |

---

## Accessibility

- Minimum touch target: 44×44px
- Text contrast ratio: ≥ 4.5:1 against card background
- Active states always have distinct color/border changes
- Loading states always prevent interaction (`disabled={true}`)
- Screen reader: all interactive elements have meaningful text content

---

## Future Standards

- When `expo-web-browser` is compiled in: enable Google OAuth button (remove stub in `hooks/useAuth.ts`)
- When `react-native-svg` is added: upgrade `ThreatMeter` to true arc progress gauge
- `expo-blur` can be added for genuine BlurView glassmorphism on modals
- `Lottie` animations can replace emoji placeholders in empty states
- `react-native-reanimated` (once stable): migrate micro-interactions for 60fps shared transitions
