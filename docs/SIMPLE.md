# Presets and settings — version 38

All supported desktop surfaces share one Soft/cached material family. Preferences expose Soft materials, Appearance, Desktop translucency, Automatic power saving, and Reduce transparency. Custom reveals Material strength; Restore selects Airy without changing master enable or Reduce transparency.

## Presets

| Look | App opacity | Popup opacity | Shell opacity | Panel tint | Overview veil | Detail reduction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Subtle | 90% | 95% | 93% | 33% | 43% | 25% |
| Balanced | 85% | 92% | 85% | 25% | 35% | 20% |
| Airy (default) | 79% | 88% | 76% | 16% | 26% | 14% |
| Mist | 72% | 84% | 65% | 5% | 15% | 7% |
| Glass | 62% | 78% | 51% | 0% | 1% | 0% |
| Crystal | 55% | 74% | 40% | 0% | 0% | 0% |

Custom spans 0–100 strength: zero is most translucent, 50 reproduces Airy, and 100 gives 95% app opacity. Whole-window translucency affects app text/images too. Dialogs retain a stronger content-opacity floor; search/folder/password-card fills retain their role-specific density.

## Minimal configuration

Only these seven GSettings keys remain:

- `enabled`
- `appearance`
- `desktop-profile`
- `material-strength`
- `auto-comfort`
- `reduce-transparency`
- `simple-profile-version` (internal upgrade marker)

Opacity and detail-reduction values are calculated by `materialValues()` from strength and are no longer stored separately. Surface scope, Soft tint, the 36 px custom blur radius, 12 px app-backdrop corners, cached filtering, menu styling, geometry protection, and workspace handling have fixed coordinated behavior. The application tracker, application list, sidebar mode, toolkit adapter, separate scope/quality/finish controls, and old 4K preset no longer exist.

## Upgrades

Current preset and strength values are retained. Earlier preset names and Custom scales still migrate through the small upgrade helper; that is why the schema accepts one hidden legacy identifier. Version-38 migration only advances the marker for an existing current profile. Removed dconf entries may remain in the user database, but the schema and runtime no longer read or recreate them. They cannot override the current profile.

The cleanup changes no system GDM configuration. The separate greeter companion remains supported. Existing manually configured native applications and user GTK CSS remain under their owners' control; Prism removes only its managed stylesheet block on disable.

## Validation

The test suite requires the schema to contain exactly these seven keys, checks all six preset densities, Custom endpoints/monotonicity, legacy migration and saved accessibility choices, and audits runtime imports and removed settings. Real GLSL composition tests retain the preset contrast ordering and expanded popup fill range. Live visual/power verification remains blocked by desktop/session access in this workspace.
