# Elementle Design Guidelines

## Design Approach

**Reference-Based Design**: Drawing inspiration from NYT Games (Wordle, Connections) for clean puzzle mechanics, combined with Duolingo's playful character-driven personality. The design balances serious historical content with lighthearted hamster mascot engagement.

**Core Principles:**
- Clarity over decoration: puzzle mechanics must be instantly readable
- Playful personality through hamster animations, not overwhelming UI flourishes
- Focus-driven layouts that guide attention to the active puzzle state
- Sophisticated color system that works for game feedback AND brand identity

---

## Color Palette

### Light Mode (Primary)
**Background & Surfaces:**
- Page background: 0 0% 98%
- Card/container background: 0 0% 100%
- Input cells (empty): 0 0% 100% with 220 13% 91% border
- Elevated surfaces: 0 0% 100% with subtle shadow

**Game Feedback Colors:**
- Correct position (green): 142 71% 45%
- In sequence (amber): 38 92% 50%
- Not in sequence (grey): 0 0% 60%
- Keyboard ruled out: 0 0% 80%
- Arrow indicators: Inherit amber/green background with white icons

**Brand & Accent:**
- Primary brand: 220 90% 56% (trustworthy blue for headers/CTAs)
- Success state: 142 71% 45% (matches correct feedback)
- Text primary: 222 47% 11%
- Text secondary: 215 16% 47%

### Dark Mode
**Background & Surfaces:**
- Page background: 222 47% 11%
- Card/container background: 217 33% 17%
- Input cells (empty): 217 33% 17% with 215 25% 27% border

**Game Feedback Colors:**
- Correct position: 142 71% 35% (slightly desaturated)
- In sequence: 38 92% 45%
- Not in sequence: 215 14% 34%
- Keyboard ruled out: 215 14% 28%

**Brand & Accent:**
- Primary brand: 220 90% 66% (brighter for visibility)
- Text primary: 210 40% 98%
- Text secondary: 215 20% 65%

---

## Typography

**Font System:** Inter (via Google Fonts CDN)

**Scale & Hierarchy:**
- H1 (Welcome/Title): 700 weight, 2.5rem (40px) desktop / 2rem mobile
- H2 (Screen headers): 600 weight, 1.875rem (30px) desktop / 1.5rem mobile
- Button labels: 500 weight, 1rem (16px)
- Input cells: 600 weight, 1.5rem (24px) - large for readability
- Body text: 400 weight, 1rem (16px)
- Event titles: 600 weight, 1.25rem (20px)
- Event descriptions: 400 weight, 0.875rem (14px)
- Small labels (streaks, stats): 500 weight, 0.75rem (12px)

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16
- Tight spacing (grid cells, keyboard buttons): p-2, gap-2
- Standard component spacing: p-4, p-6, gap-4
- Section spacing: py-8, py-12, px-4
- Large screen separation: py-16, gap-16

**Container Strategy:**
- Max width: max-w-md (448px) for puzzle interface - keeps it focused
- Welcome/Selection screens: max-w-lg (512px) centered
- Responsive breakpoints: sm (640px), md (768px), lg (1024px)
- Mobile-first with comfortable tap targets (min 44x44px)

---

## Component Library

### Input Grid
- 5 rows × 8 columns fixed grid
- Cell dimensions: 40x40px mobile, 52x52px desktop
- Border: 2px solid, rounded-md (6px)
- Gap between cells: gap-1 (4px)
- Gap between rows: gap-2 (8px)
- Active row has subtle glow: shadow-sm
- Feedback states fill entire cell with color + border removed
- Arrow icons: 16x16px, white, positioned top-right of amber/green cells

### Numeric Keyboard
- 3×4 grid layout: [1-9] in three rows, [Clear, 0, Del, Enter] bottom row
- Button size: 56x56px mobile, 64x64px desktop
- Rounded: rounded-lg (8px)
- Default state: bg white/dark surface, border subtle
- Hover: slight scale (scale-105), shadow
- Active press: scale-95
- Disabled (ruled out): bg grey, opacity-50, cursor-not-allowed
- Amber state: bg amber, text white
- Green state: bg green, text white

### Buttons (Navigation/Actions)
- Primary CTA: bg-blue-600, text-white, px-8 py-3, rounded-lg, hover:bg-blue-700
- Secondary: bg-transparent, border-2 border-blue-600, text-blue-600, hover:bg-blue-50
- Placeholder buttons: opacity-60, cursor-not-allowed
- "Play without signing in": smaller text-sm, text-secondary

### Cards & Containers
- Welcome/Selection screens: bg-white/dark-surface, rounded-xl, shadow-lg, p-8
- Event reveal card: bg-white/dark-surface, rounded-lg, p-6, border-l-4 border-blue-600
- Streak display: inline-flex items-center, gap-2, bg-blue-50/dark-variant, rounded-full, px-4 py-2

---

## Hamster Animation Character

**Placement:** Center of end-game reveal modal, 120x120px container

**Win State Animation:**
- Dancing hamster GIF/animation (bouncing, arms up)
- Confetti particles: falling from top, randomized colors (blue, green, amber, pink)
- Fireworks: 2-3 bursts radiating from behind hamster
- Animation duration: 3-4 seconds, loops once

**Loss State Animation:**
- Hamster shaking head side-to-side (2-3 shakes)
- Paws/hands cover face afterward
- Subtle shake applied to entire reveal card
- Animation duration: 2 seconds, plays once

---

## Screen-Specific Layouts

### Welcome Screen
- Centered vertical layout, max-w-lg
- Logo/title at top (consider simple hamster icon + "Elementle" wordmark)
- Large primary buttons stacked: "Login" and "Sign up" (60px height)
- Small "Play without signing in" link below, text-sm
- Soft gradient background option: blue-50 to white

### Game Selection Screen
- Grid layout: 2×3 on desktop, 1 column on mobile
- "Play" button: larger, blue gradient, prominent
- Placeholder buttons: greyed out, same size
- Button size: 140x140px desktop, full-width mobile, 80px height

### Play Screen
- Input grid: centered, mb-8
- Keyboard: centered below grid, mb-4
- Guess history: above grid, right-aligned, compact list (previous guesses with small feedback indicators)
- Streak counter: top-right corner, badge style
- All contained within max-w-md container

### End Game Reveal Modal
- Overlay: bg-black/50 backdrop blur
- Modal card: max-w-lg, centered, bg-white/dark-surface, rounded-xl, p-8
- Hamster animation: top center, mb-6
- Event title: h2 styling, mb-2
- Event description: body text, mb-6
- Stats comparison: simple grid, 3 columns (You, Bot, Global - placeholders)
- "Play Again" button: primary CTA at bottom

---

## Animations & Interactions

**Minimal Animation Philosophy:** Use sparingly, only for meaningful feedback

**Applied Animations:**
- Cell reveal: Stagger fill animation on guess submission (0.1s delay per cell)
- Keyboard state change: Smooth color transition (200ms)
- Modal entrance: Scale up from 0.95 + fade in (300ms)
- Incorrect guess: Horizontal shake on row (400ms)
- Hamster win/loss: As described above
- Button interactions: Subtle scale transforms only

**No Animations For:**
- Screen transitions (instant)
- Text appearance
- Background changes

---

## Accessibility & Responsive Design

- Color feedback supplemented by icons (arrows) for colorblind users
- Focus states: 2px blue ring on all interactive elements
- Touch targets: minimum 44x44px
- Keyboard navigation: full support with visible focus indicators
- Screen reader labels on all game state changes
- Dark mode toggle: top-right corner of all screens, moon/sun icon
- Mobile: stack all grids to single column, increase touch targets
- Tablet: maintain desktop layout with adjusted spacing

---

## Images

**No hero images required.** This is a focused puzzle game application. Visual interest comes from:
- Optional hamster mascot icon in header/logo
- Game feedback colors and grid patterns
- End-game hamster animations (GIF or Lottie files)

If mascot artwork needed: Simple, friendly cartoon hamster, 2D illustration style, warm browns/oranges, minimal detail for versatility across UI scales.