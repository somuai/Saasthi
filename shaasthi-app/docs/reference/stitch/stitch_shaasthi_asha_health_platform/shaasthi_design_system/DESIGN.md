---
name: MediLift Design System
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#44474c'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#74777d'
  outline-variant: '#c4c6cc'
  surface-tint: '#525f71'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#0f1c2c'
  on-primary-container: '#778598'
  inverse-primary: '#bac8dc'
  secondary: '#15686f'
  on-secondary: '#ffffff'
  secondary-container: '#a6eff6'
  on-secondary-container: '#1f6e75'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#00210f'
  on-tertiary-container: '#39945f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e4f9'
  primary-fixed-dim: '#bac8dc'
  on-primary-fixed: '#0f1c2c'
  on-primary-fixed-variant: '#3a4859'
  secondary-fixed: '#a6eff6'
  secondary-fixed-dim: '#8bd2da'
  on-secondary-fixed: '#002022'
  on-secondary-fixed-variant: '#004f55'
  tertiary-fixed: '#9af6b8'
  tertiary-fixed-dim: '#7ed99e'
  on-tertiary-fixed: '#00210f'
  on-tertiary-fixed-variant: '#00522d'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  headline-lg:
    fontFamily: Roboto Flex
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: 0px
  headline-md:
    fontFamily: Roboto Flex
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: 0px
  headline-sm:
    fontFamily: Roboto Flex
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: 0.1px
  body-lg:
    fontFamily: Roboto Flex
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.5px
  body-md:
    fontFamily: Roboto Flex
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.25px
  label-lg:
    fontFamily: Roboto Flex
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.5px
  label-hindi:
    fontFamily: Roboto Flex
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  touch-target: 48px
  container-padding: 16px
  stack-gap: 12px
  section-margin: 24px
  gutter: 16px
---

## Brand & Style

The design system is engineered for the frontline of public health, specifically optimized for ASHA workers navigating rural environments on mid-range Android devices. The aesthetic is **Corporate/Modern** with a focus on **Minimalism**, prioritizing utility and institutional trust over decorative flair.

The visual narrative is grounded in reliability and "Government-Official" aesthetics. It utilizes a flat design language to ensure high performance on lower-end hardware and maximum legibility under varying outdoor lighting conditions. The emotional response is one of stability, authority, and ease of use, reducing cognitive load for users who manage critical health data.

## Colors

This design system employs a high-contrast, professional palette designed for readability and semantic clarity.

- **Primary (Navy):** Used for primary branding, top app bars, and high-level headings to establish authority.
- **Secondary (Teal):** Reserved for primary actions (CTAs) and interactive elements to distinguish them from static content.
- **Success (Green):** Applied to positive health outcomes and completed tasks.
- **Surface & Backgrounds:** A clean white base with light gray (#F1F3F5) used for grouping content within sections.
- **High-Risk/Danger:** Uses a soft red background with a solid red foreground to ensure accessibility without causing unnecessary alarm.

## Typography

The typography system relies on **Roboto Flex** for its exceptional legibility and systematic scaling on Android platforms. 

For **Bilingual Support**, English and Hindi labels are treated with a clear hierarchy:
- English serves as the primary label in `headline-sm` or `body-md`.
- Hindi translations are placed immediately below or beside the English text using the `label-hindi` style, often in a slightly lighter gray to maintain focus while ensuring comprehension.
- **Headings** always use the Primary Navy color to anchor the page, while **Subtitles** and secondary info use a mid-tone gray (#5F6368).

## Layout & Spacing

This design system follows a **Fluid Grid** model optimized for mobile handsets. The layout is built on an 8dp baseline grid to ensure alignment and rhythm.

- **Margins:** Standard screen margins are 16px.
- **Touch Targets:** A strict minimum of 48x48dp is enforced for all interactive elements (buttons, checkboxes, navigation) to accommodate varied dexterity and field use.
- **Grid:** A 4-column layout for mobile, where cards typically span all 4 columns for maximum tap area.
- **Vertical Rhythm:** Content is stacked with 12px or 16px gaps to maintain a clean, breathable interface despite the high information density.

## Elevation & Depth

In alignment with a **Flat Design** and Material 3 approach, depth is conveyed through **Tonal Layers** rather than heavy drop shadows. This ensures the UI remains crisp and performs well on devices with limited rendering power.

- **Surface Levels:** The main background is white. "Containers" or "Cards" use a very light gray (#F8F9FA) or a subtle 1px stroke (#DEE2E6) to separate content.
- **Active States:** Subtle tonal shifts (e.g., a slightly darker gray background on press) provide tactile feedback without the need for 3D effects.
- **Zero-Shadow Rule:** Avoid shadows on standard cards. Reserve minimal, diffused shadows only for high-importance floating elements like FABs (Floating Action Buttons).

## Shapes

The shape language is professional and modern, utilizing **Rounded** corners to make the application feel approachable yet structured.

- **Cards:** Use a 12px radius (`rounded-lg` equivalent in this system) to group related health data.
- **Buttons & Chips:** Use a full pill-shape (radius 24px+) to clearly indicate interactivity and contrast against the rectangular layout of data cards.
- **Form Inputs:** Use a 8px radius to balance the cards and buttons, providing a clear "receptacle" feel for data entry.

## Components

### Buttons & Chips
- **Primary Button:** Pill-shaped, solid Teal background with white text. Height: 48dp.
- **Secondary Button:** Outlined (1px Teal) with Teal text.
- **Chips:** Pill-shaped, light gray background. Used for status indicators (e.g., "High Risk") or filters.

### Cards
- **Data Cards:** 12px rounded corners, 1px light border, no shadow. Contains a mix of Navy headings and Gray body text.
- **Action Cards:** Feature a Primary Navy icon on the left to denote the card's purpose (e.g., "Add Patient").

### Form Elements
- **Input Fields:** Filled style with a bottom-line indicator (Material 3 style) or 8px rounded outlines. 
- **Tap Targets:** Checkboxes and Radio buttons must be contained within 48dp rows to ensure easy selection in the field.

### Progress Bars
- **Linear Progress:** Used to track patient milestones. Teal for active progress, Success Green for completion. 4px height with rounded caps.

### Bilingual Labels
- All critical labels must include the Hindi equivalent in a secondary typographic weight directly beneath the English term to assist users who are more comfortable with local scripts.