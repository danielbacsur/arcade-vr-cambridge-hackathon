---
name: Six Seven control room
description: Outside input and player-head camera station for the Arcade integration lab.
colors:
  neutral-bg: "#f4f5f2"
  text: "#17262c"
  secondary-text: "#53676b"
  media-bg: "#101820"
  divider: "#ccd3cf"
  button-bg: "#fff"
  button-text: "#20373b"
  button-border: "#c5ceca"
  primary: "#24674e"
  held-bg: "#d5e8df"
  held-border: "#267654"
  focus: "#438c75"
  joystick-bg: "#e8ede8"
  joystick-border: "#a9bcb3"
  stick: "#2c7157"
  telemetry: "#36534a"
typography:
  body:
    fontFamily: "system-ui, -apple-system, sans-serif"
  section-title:
    fontSize: "16px"
    fontWeight: 700
  button:
    fontFamily: "system-ui"
    fontSize: "13px"
    fontWeight: 600
  status:
    fontSize: "13px"
  helper:
    fontSize: "12px"
    lineHeight: 1.5
  telemetry:
    fontFamily: "ui-monospace, monospace"
    fontSize: "12px"
    lineHeight: 1.5
rounded:
  control: "6px"
  media: "8px"
  circular: "50%"
spacing:
  control-gap: "8px"
  section-gap: "24px"
  desktop-inset: "28px"
  mobile-inset: "18px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.button-bg}"
    rounded: "{rounded.control}"
    typography: "{typography.button}"
    padding: "12px 14px"
  button-standard:
    backgroundColor: "{colors.button-bg}"
    textColor: "{colors.button-text}"
    rounded: "{rounded.control}"
    typography: "{typography.button}"
    padding: "12px 14px"
  button-held:
    backgroundColor: "{colors.held-bg}"
    textColor: "{colors.button-text}"
    rounded: "{rounded.control}"
  media:
    backgroundColor: "{colors.media-bg}"
    rounded: "{rounded.media}"
    width: "100%"
---

# Design System: Six Seven control room

## Overview

**Creative North Star: "The Control Station"**

A neutral control station keeps the live game and the player’s second viewpoint beside direct outside inputs. Pale surfaces support readable labels and status; dark media regions carry the game imagery. Green identifies connection and input feedback. Density is practical, with controls grouped by task and diagnostics kept in a disclosure.

This is an operational extension of the integration lab. Its visual authority is the shipped controller, not a new marketing identity. The external Arcade game owns its imagery; these rules describe the wrapper and controls.

**Key Characteristics:**
- Neutral light wrapper around dark live media.
- Green identifies connection and held input.
- Direct controls, readable status, and explicit release.

## Colors

The palette combines pale neutral surfaces, dark media, and a restrained green family for operation.

### Primary

- **Connection green:** the connect button and native range accent.
- **Held green:** pale button fill and stronger border when an input is pressed or held.
- **Focus green:** visible keyboard outline around buttons and the joystick.
- **Joystick green:** the movable stick; telemetry uses a quieter related green.

### Neutral

- **Pale workspace:** the page background.
- **Deep text:** primary content, with quieter secondary status and helper text.
- **Dark media:** the embedded game and camera canvas before imagery arrives.
- **White controls:** button backgrounds and the stick’s rim.
- **Muted dividers:** media border, diagnostic separator, and control borders.

**The Input Feedback Rule.** Green communicates operational controls and input state rather than decoration.

## Typography

Native system text supports the existing lab’s compact controls. Section titles are bold; buttons use semibold labels; telemetry is monospace. Supporting labels, hints, and diagnostics use a small utilitarian hierarchy. Frontmatter records reusable control roles; the page’s current system-font heading is not a display-font precedent.

## Layout

The desktop page has an outer inset and a two-column grid: game at `minmax(0, 1.2fr)`, station at `minmax(400px, 1fr)`. The columns have a section gap. Each media region has a title and right-aligned state above it. The game frame is 760px tall; the camera has a 16:9 ratio and a 640 × 360 drawing buffer.

Below the camera, connection and stop buttons share a row. Movement and actions form a second grid with a 180px movement column and flexible action column, separated by 26px. Action pairs share available width. The directional pad uses three equal columns with 5px gaps.

At 900px and below, the main grid stacks, the page inset reduces, the game frame becomes 500px tall, and the control grid uses a 176px movement column with an 18px gap. At 470px and below, movement and actions stack; the circular joystick and pad share the movement row, and connection controls can wrap. Diagnostics span the main grid below both regions.

## Elevation & Depth

The wrapper is flat and relies on borders, pale tonal layering, and dark media to distinguish regions. Only the joystick stick has a small shadow (`0 3px 8px #17262c22`), reinforcing its movable position. There is no panel shadow system.

## Shapes

Controls have modest rounded corners and a thin border. Media regions use slightly larger corners. The movement surface and stick are circular; crosshair lines define the movement center. Directional controls use inline SVG arrows rather than text glyphs.

## Components

### Buttons

Standard controls use a white fill, dark text, thin neutral border, and consistent padding. Connection uses solid green with white text. Pressed or held controls use the held fill and green border. Buttons, the joystick, and the player-view canvas receive a 3px focus outline with a 3px offset. Inputs use immediate feedback without decorative transitions.

### Movement joystick

A circular 176px movement area contains a 58px stick with a 5px white rim. Pointer movement translates the stick directly within a 58px travel radius. Pointer release, cancellation, lost capture, window blur, and hidden-page handling release movement. Do not infer a spring or easing curve: none is implemented.

### Range inputs

Native range controls span the action column and use the connection accent. Labels sit above each field with a 3px gap. The source retains browser-native focus behavior for ranges; there is no custom field skin.

### Live media

The game remains an iframe with its original viewpoint. The separate canvas shows live player-head imagery and is a direct look control. It uses a grab cursor, changes to grabbing during captured pointer input, suppresses touch scrolling within the surface, and receives visible keyboard focus. Dragging sends incremental yaw and pitch to the game’s native look controller; focused arrow keys and the optional ranges use the same look protocol. The head camera copies the actual main-camera rotation, and movement follows that view. There is no decorative camera easing in the wrapper.

Both media regions use a dark fallback surface. Status appears above the camera, while coordinate and look-angle telemetry below the controls uses preserved line breaks. This canvas is live game output rather than a simulated image.

### Diagnostics

A native disclosure with a thin top divider contains inspection and test buttons plus wrapped, scrollable diagnostic text. It keeps operational details available without adding a new panel hierarchy.

## Do's and Don'ts

### Do:
- Do keep the game, head-camera feed, and controls visibly related.
- Do use green for connection and input feedback.
- Do preserve visible focus and held-state feedback.
- Do stack the two main regions at the established narrow-screen breakpoint.

### Don't:
- Don’t replace live media with decorative imagery.
- Don’t add decorative motion to continuous input.
- Don’t promote the remaining uppercase labels or system heading into a display identity.

## Character-control update, v0.4

The station now accepts an Arcade play URL and a single configurable game-action key. The head-view gesture controls independent yaw/pitch; the original game remains a separate spectator view. Movement follows the head view through input-coordinate conversion. The same adapter was exercised in Six Seven and Purrbound Island. Existing green focus/held feedback and neutral wrapper styling remain.
