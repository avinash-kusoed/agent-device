import { isMap, isScalar, type Node } from 'yaml';
import { stripUndefined } from './shared.ts';
import type {
  MaestroAirplaneModeValue,
  MaestroCopyTextFromCommand,
  MaestroInputRandomCommand,
  MaestroInputRandomType,
  MaestroKillAppCommand,
  MaestroOrientationName,
  MaestroPasteTextCommand,
  MaestroPermissionAction,
  MaestroPermissionGrant,
  MaestroPermissionTarget,
  MaestroSetAirplaneModeCommand,
  MaestroSetClipboardCommand,
  MaestroSetLocationCommand,
  MaestroSetOrientationCommand,
  MaestroSetPermissionsCommand,
  MaestroTravelCommand,
  MaestroTravelPoint,
  MaestroToggleAirplaneModeCommand,
} from './program-ir.ts';
import {
  parseMaestroSelector,
  parseMaestroSelectorMapEntries,
} from './program-ir-selector-parser.ts';
import { readMaestroCommandLabel } from './program-ir-command-options.ts';
import { MAESTRO_BASE_SELECTOR_KEYS } from './selector-vocabulary.ts';
import {
  assertOnlyKeys,
  entryValue,
  hasEntry,
  invalidAt,
  isNullNode,
  readMapEntries,
  readOptionalEntry,
  readOptionalNumeric,
  readOptionalString,
  readRequiredNumeric,
  readRequiredString,
  readScalarValue,
  readSequenceItems,
  sourceAt,
  type MaestroProgramParseContext,
} from './program-ir-values.ts';

const MAESTRO_PERMISSION_TARGETS = [
  'camera',
  'microphone',
  'photos',
  'contacts',
  'contacts-limited',
  'notifications',
  'calendar',
  'location',
  'location-always',
  'media-library',
  'motion',
  'reminders',
  'siri',
  'accessibility',
  'screen-recording',
  'input-monitoring',
] as const satisfies readonly MaestroPermissionTarget[];

const PERMISSION_NAME_ALIASES: Readonly<Record<string, MaestroPermissionTarget>> = {
  camera: 'camera',
  microphone: 'microphone',
  photos: 'photos',
  contacts: 'contacts',
  'contacts-limited': 'contacts-limited',
  contactslimited: 'contacts-limited',
  notifications: 'notifications',
  calendar: 'calendar',
  location: 'location',
  'location-always': 'location-always',
  locationalways: 'location-always',
  'media-library': 'media-library',
  medialibrary: 'media-library',
  motion: 'motion',
  reminders: 'reminders',
  siri: 'siri',
  accessibility: 'accessibility',
  'screen-recording': 'screen-recording',
  screenrecording: 'screen-recording',
  'input-monitoring': 'input-monitoring',
  inputmonitoring: 'input-monitoring',
};

export function parseKillApp(
  value: Node | null,
  commandNode: Node,
  context: MaestroProgramParseContext,
): MaestroKillAppCommand {
  const source = sourceAt(commandNode, context);
  if (isNullNode(value)) return { kind: 'killApp', source };
  return { kind: 'killApp', source, appId: readRequiredString(value, 'killApp', context) };
}

export function parseSetLocation(
  value: Node | null,
  commandNode: Node,
  context: MaestroProgramParseContext,
): MaestroSetLocationCommand {
  const entries = readMapEntries(value, 'setLocation', context);
  assertOnlyKeys(entries, 'setLocation', ['latitude', 'longitude'], context);
  if (!hasEntry(entries, 'latitude') || !hasEntry(entries, 'longitude')) {
    invalidAt('Maestro setLocation requires latitude and longitude.', commandNode, context);
  }
  return {
    kind: 'setLocation',
    source: sourceAt(commandNode, context),
    latitude: readCoordinate(entryValue(entries, 'latitude'), 'setLocation.latitude', context),
    longitude: readCoordinate(entryValue(entries, 'longitude'), 'setLocation.longitude', context),
  };
}

export function parseSetOrientation(
  value: Node | null,
  commandNode: Node,
  context: MaestroProgramParseContext,
): MaestroSetOrientationCommand {
  const source = sourceAt(commandNode, context);
  const raw = isMap(value)
    ? (() => {
        const entries = readMapEntries(value, 'setOrientation', context);
        assertOnlyKeys(entries, 'setOrientation', ['orientation'], context);
        if (!hasEntry(entries, 'orientation')) {
          invalidAt('Maestro setOrientation requires orientation.', commandNode, context);
        }
        return readRequiredString(
          entryValue(entries, 'orientation'),
          'setOrientation.orientation',
          context,
        );
      })()
    : readRequiredString(value, 'setOrientation', context);
  return {
    kind: 'setOrientation',
    source,
    orientation: parseOrientationName(raw, value ?? commandNode, context),
  };
}

export function parseSetAirplaneMode(
  value: Node | null,
  commandNode: Node,
  context: MaestroProgramParseContext,
): MaestroSetAirplaneModeCommand {
  const source = sourceAt(commandNode, context);
  if (isMap(value)) {
    const entries = readMapEntries(value, 'setAirplaneMode', context);
    assertOnlyKeys(entries, 'setAirplaneMode', ['value'], context);
    if (!hasEntry(entries, 'value')) {
      invalidAt('Maestro setAirplaneMode requires value.', commandNode, context);
    }
    return {
      kind: 'setAirplaneMode',
      source,
      value: parseAirplaneModeValue(
        entryValue(entries, 'value'),
        'setAirplaneMode.value',
        context,
      ),
    };
  }
  return {
    kind: 'setAirplaneMode',
    source,
    value: parseAirplaneModeValue(value, 'setAirplaneMode', context),
  };
}

export function parseToggleAirplaneMode(
  value: Node | null,
  commandNode: Node,
  context: MaestroProgramParseContext,
): MaestroToggleAirplaneModeCommand {
  if (!isNullNode(value)) {
    invalidAt('Maestro toggleAirplaneMode does not accept a value.', value, context);
  }
  return { kind: 'toggleAirplaneMode', source: sourceAt(commandNode, context) };
}

export function parseSetPermissions(
  value: Node | null,
  commandNode: Node,
  context: MaestroProgramParseContext,
): MaestroSetPermissionsCommand {
  const entries = readMapEntries(value, 'setPermissions', context);
  assertOnlyKeys(entries, 'setPermissions', ['permissions', 'appId'], context);
  if (!hasEntry(entries, 'permissions')) {
    invalidAt('Maestro setPermissions requires permissions.', commandNode, context);
  }
  const appId = readOptionalEntry(entries, 'appId', (entry) =>
    readOptionalString(entry, 'setPermissions.appId', context),
  );
  const grants = parsePermissionGrants(
    entryValue(entries, 'permissions'),
    commandNode,
    context,
  );
  return stripUndefined({
    kind: 'setPermissions' as const,
    source: sourceAt(commandNode, context),
    appId,
    grants,
  });
}

export function parseCopyTextFrom(
  value: Node | null,
  commandNode: Node,
  context: MaestroProgramParseContext,
): MaestroCopyTextFromCommand {
  const source = sourceAt(commandNode, context);
  if (isScalar(value) || isNullNode(value)) {
    return {
      kind: 'copyTextFrom',
      source,
      target: parseMaestroSelector(value, 'copyTextFrom', context),
    };
  }
  const entries = readMapEntries(value, 'copyTextFrom', context);
  assertOnlyKeys(entries, 'copyTextFrom', [...MAESTRO_BASE_SELECTOR_KEYS, 'label'], context);
  const label = readMaestroCommandLabel(entries, 'copyTextFrom', context);
  const selectorEntries = entries.filter((entry) => entry.key !== 'label');
  if (selectorEntries.length === 0) {
    invalidAt('Maestro copyTextFrom requires a selector.', commandNode, context);
  }
  return stripUndefined({
    kind: 'copyTextFrom' as const,
    source,
    target: parseMaestroSelectorMapEntries(selectorEntries, 'copyTextFrom', context),
    label,
  });
}

export function parseSetClipboard(
  value: Node | null,
  commandNode: Node,
  context: MaestroProgramParseContext,
): MaestroSetClipboardCommand {
  const source = sourceAt(commandNode, context);
  if (isScalar(value)) {
    return {
      kind: 'setClipboard',
      source,
      text: readRequiredString(value, 'setClipboard', context),
    };
  }
  const entries = readMapEntries(value, 'setClipboard', context);
  assertOnlyKeys(entries, 'setClipboard', ['text', 'label'], context);
  if (!hasEntry(entries, 'text')) {
    invalidAt('Maestro setClipboard requires text.', commandNode, context);
  }
  const text = readRequiredString(entryValue(entries, 'text'), 'setClipboard.text', context);
  const label = readMaestroCommandLabel(entries, 'setClipboard', context);
  return stripUndefined({ kind: 'setClipboard' as const, source, text, label });
}

export function parsePasteText(
  value: Node | null,
  commandNode: Node,
  context: MaestroProgramParseContext,
): MaestroPasteTextCommand {
  const source = sourceAt(commandNode, context);
  if (isNullNode(value)) return { kind: 'pasteText', source };
  if (isScalar(value)) {
    invalidAt(
      'Maestro pasteText does not accept inline text; use setClipboard or copyTextFrom first.',
      value,
      context,
    );
  }
  const entries = readMapEntries(value, 'pasteText', context);
  assertOnlyKeys(entries, 'pasteText', ['label'], context);
  const label = readMaestroCommandLabel(entries, 'pasteText', context);
  return stripUndefined({ kind: 'pasteText' as const, source, label });
}

export function parseTravel(
  value: Node | null,
  commandNode: Node,
  context: MaestroProgramParseContext,
): MaestroTravelCommand {
  const entries = readMapEntries(value, 'travel', context);
  assertOnlyKeys(entries, 'travel', ['points', 'speed'], context);
  if (!hasEntry(entries, 'points')) {
    invalidAt('Maestro travel requires points.', commandNode, context);
  }
  const points = parseTravelPoints(entryValue(entries, 'points'), context);
  if (points.length === 0) {
    invalidAt('Maestro travel requires at least one point.', commandNode, context);
  }
  const speed = hasEntry(entries, 'speed')
    ? readOptionalNumeric(entryValue(entries, 'speed'), 'travel.speed', context, {
        positive: true,
      })
    : undefined;
  return stripUndefined({
    kind: 'travel' as const,
    source: sourceAt(commandNode, context),
    points,
    speed,
  });
}

export function parseInputRandom(
  inputType: MaestroInputRandomType,
  value: Node | null,
  commandNode: Node,
  context: MaestroProgramParseContext,
): MaestroInputRandomCommand {
  const source = sourceAt(commandNode, context);
  const commandName = inputRandomCommandName(inputType);
  if (isNullNode(value)) {
    return { kind: 'inputRandom', source, inputType };
  }
  if (isScalar(value)) {
    return {
      kind: 'inputRandom',
      source,
      inputType,
      length: readRequiredNumeric(value, commandName, context),
    };
  }
  const entries = readMapEntries(value, commandName, context);
  assertOnlyKeys(entries, commandName, ['length', 'label'], context);
  const length = hasEntry(entries, 'length')
    ? readOptionalNumeric(entryValue(entries, 'length'), `${commandName}.length`, context, {
        integer: true,
        positive: true,
      })
    : undefined;
  const label = readMaestroCommandLabel(entries, commandName, context);
  return stripUndefined({ kind: 'inputRandom' as const, source, inputType, length, label });
}

function inputRandomCommandName(inputType: MaestroInputRandomType): string {
  switch (inputType) {
    case 'text':
      return 'inputRandomText';
    case 'number':
      return 'inputRandomNumber';
    case 'email':
      return 'inputRandomEmail';
    case 'personName':
      return 'inputRandomPersonName';
    case 'cityName':
      return 'inputRandomCityName';
    case 'countryName':
      return 'inputRandomCountryName';
    case 'colorName':
      return 'inputRandomColorName';
  }
}

function parseTravelPoints(
  node: Node | null | undefined,
  context: MaestroProgramParseContext,
): MaestroTravelPoint[] {
  return readSequenceItems(node, 'travel.points', context).map((item, index) =>
    parseTravelPoint(item, `travel.points[${index}]`, context),
  );
}

function parseTravelPoint(
  node: Node | null | undefined,
  name: string,
  context: MaestroProgramParseContext,
): MaestroTravelPoint {
  if (isMap(node)) {
    const entries = readMapEntries(node, name, context);
    assertOnlyKeys(entries, name, ['latitude', 'longitude'], context);
    if (!hasEntry(entries, 'latitude') || !hasEntry(entries, 'longitude')) {
      invalidAt(`Maestro ${name} requires latitude and longitude.`, node, context);
    }
    return {
      latitude: readCoordinate(entryValue(entries, 'latitude'), `${name}.latitude`, context),
      longitude: readCoordinate(entryValue(entries, 'longitude'), `${name}.longitude`, context),
    };
  }
  const raw = readRequiredString(node, name, context);
  const match = /^\s*([^,]+)\s*,\s*([^,]+)\s*$/.exec(raw);
  if (!match) {
    invalidAt(`Maestro ${name} expects "lat,lng" or a latitude/longitude map.`, node, context);
  }
  return {
    latitude: parseCoordinateToken(match[1]!, `${name}.latitude`, node, context),
    longitude: parseCoordinateToken(match[2]!, `${name}.longitude`, node, context),
  };
}

function readCoordinate(
  node: Node | null | undefined,
  name: string,
  context: MaestroProgramParseContext,
): number | string {
  const value = readScalarValue(node, name, context);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    if (/^\$\{[A-Za-z_][A-Za-z0-9_.]*\}$/.test(value)) return value;
  }
  invalidAt(`Maestro ${name} expects a number or variable expression.`, node, context);
}

function parseCoordinateToken(
  raw: string,
  name: string,
  node: Node | null | undefined,
  context: MaestroProgramParseContext,
): number | string {
  const token = raw.trim();
  if (/^-?\d+(\.\d+)?$/.test(token)) return Number(token);
  if (/^\$\{[A-Za-z_][A-Za-z0-9_.]*\}$/.test(token)) return token;
  invalidAt(`Maestro ${name} expects a number or variable expression.`, node, context);
}

function parseOrientationName(
  raw: string,
  node: Node | null | undefined,
  context: MaestroProgramParseContext,
): MaestroOrientationName {
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  switch (normalized) {
    case 'portrait':
      return 'portrait';
    case 'landscape_left':
    case 'landscapeleft':
      return 'landscape-left';
    case 'landscape_right':
    case 'landscaperight':
      return 'landscape-right';
    case 'upside_down':
    case 'upsidedown':
    case 'portrait_upside_down':
    case 'portraitupsidedown':
      return 'portrait-upside-down';
    default:
      invalidAt(
        `Maestro setOrientation "${raw}" is not supported. Use PORTRAIT, LANDSCAPE_LEFT, LANDSCAPE_RIGHT, or UPSIDE_DOWN.`,
        node,
        context,
      );
  }
}

function parseAirplaneModeValue(
  node: Node | null | undefined,
  name: string,
  context: MaestroProgramParseContext,
): MaestroAirplaneModeValue {
  const value = readScalarValue(node, name, context);
  if (typeof value === 'boolean') return value ? 'enabled' : 'disabled';
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'enabled' || normalized === 'enable' || normalized === 'on') {
      return 'enabled';
    }
    if (normalized === 'disabled' || normalized === 'disable' || normalized === 'off') {
      return 'disabled';
    }
  }
  invalidAt(`Maestro ${name} expects enabled or disabled.`, node, context);
}

function parsePermissionGrants(
  node: Node | null | undefined,
  commandNode: Node,
  context: MaestroProgramParseContext,
): MaestroPermissionGrant[] {
  const entries = readMapEntries(node, 'setPermissions.permissions', context);
  if (entries.length === 0) {
    invalidAt('Maestro setPermissions.permissions must not be empty.', node, context);
  }
  const explicit = new Map<MaestroPermissionTarget, MaestroPermissionAction>();
  let allAction: MaestroPermissionAction | undefined;
  for (const entry of entries) {
    const action = parsePermissionAction(
      entry.value,
      `setPermissions.permissions.${entry.key}`,
      context,
    );
    const key = normalizePermissionKey(entry.key);
    if (key === 'all') {
      allAction = action;
      continue;
    }
    const resolved = PERMISSION_NAME_ALIASES[key];
    if (!resolved) {
      invalidAt(
        `Maestro setPermissions permission "${entry.key}" is not supported.`,
        entry.keyNode,
        context,
      );
    }
    explicit.set(resolved, action);
  }
  const grants = new Map<MaestroPermissionTarget, MaestroPermissionAction>();
  if (allAction) {
    for (const target of MAESTRO_PERMISSION_TARGETS) {
      grants.set(target, allAction);
    }
  }
  for (const [target, action] of explicit) {
    grants.set(target, action);
  }
  if (grants.size === 0) {
    invalidAt('Maestro setPermissions.permissions must not be empty.', commandNode, context);
  }
  return [...grants.entries()].map(([target, action]) => ({ target, action }));
}

function normalizePermissionKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function parsePermissionAction(
  node: Node | null | undefined,
  name: string,
  context: MaestroProgramParseContext,
): MaestroPermissionAction {
  const raw = readRequiredString(node, name, context).trim().toLowerCase();
  if (raw === 'allow' || raw === 'grant') return 'grant';
  if (raw === 'deny') return 'deny';
  if (raw === 'unset' || raw === 'reset') return 'reset';
  invalidAt(
    `Maestro ${name} expects allow, deny, or unset.`,
    node,
    context,
  );
}

