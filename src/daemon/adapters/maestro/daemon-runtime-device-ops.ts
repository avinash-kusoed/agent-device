import { AppError } from '@agent-device/kernel/errors';
import { registerDiagnosticSensitiveValue } from '@agent-device/host-kit/diagnostics';
import type {
  MaestroDispatchSelector,
  MaestroInputRandomType,
  MaestroRuntimeOperationContext,
  MaestroTravelPoint,
} from '@agent-device/maestro';
import type { MaestroPublicOperation } from './daemon-runtime-public-operation.ts';
import type { CreateDaemonMaestroRuntimeOperationsOptions } from './daemon-runtime-port-support.ts';
import type { DaemonResponseData } from '../../daemon-request.ts';

type InvokeMutation = (
  operation: MaestroPublicOperation,
  context: MaestroRuntimeOperationContext,
  stability?: 'none' | 'deferred',
) => Promise<DaemonResponseData | undefined>;

type TypeTextAndSettle = (
  text: string,
  context: MaestroRuntimeOperationContext,
  settleTimeoutMs?: number,
) => Promise<void>;

export async function executeMaestroSetLocation(
  input: { latitude: number; longitude: number },
  context: MaestroRuntimeOperationContext,
  invokeMutation: InvokeMutation,
): Promise<void> {
  await invokeMutation(
    { kind: 'setLocation', latitude: input.latitude, longitude: input.longitude },
    context,
  );
}

export async function executeMaestroSetOrientation(
  orientation: string,
  context: MaestroRuntimeOperationContext,
  invokeMutation: InvokeMutation,
): Promise<void> {
  await invokeMutation({ kind: 'setOrientation', orientation }, context);
}

export async function executeMaestroSetAirplaneMode(
  enabled: boolean,
  context: MaestroRuntimeOperationContext,
  invokeMutation: InvokeMutation,
): Promise<void> {
  await invokeMutation({ kind: 'setAirplaneMode', enabled }, context);
}

export async function executeMaestroToggleAirplaneMode(
  context: MaestroRuntimeOperationContext,
  options: CreateDaemonMaestroRuntimeOperationsOptions,
  invokeMutation: InvokeMutation,
): Promise<void> {
  if (options.platform === 'ios') {
    throw new AppError(
      'UNSUPPORTED_OPERATION',
      'Maestro toggleAirplaneMode is not supported on iOS.',
      {
        hint: 'Use setAirplaneMode with an explicit enabled or disabled value.',
      },
    );
  }
  const device = options.device;
  if (!device) {
    throw new AppError(
      'COMMAND_FAILED',
      'Maestro toggleAirplaneMode requires a resolved session device.',
    );
  }
  const current = await readAndroidAirplaneModeOn(device.id);
  await invokeMutation({ kind: 'setAirplaneMode', enabled: !current }, context);
}

export async function executeMaestroSetPermissions(
  input: {
    appId?: string;
    grants: readonly { target: string; action: 'grant' | 'deny' | 'reset' }[];
  },
  context: MaestroRuntimeOperationContext,
  invokeMutation: InvokeMutation,
): Promise<void> {
  for (const grant of input.grants) {
    await invokeMutation(
      {
        kind: 'setPermission',
        action: grant.action,
        permission: grant.target,
        ...(input.appId ? { appId: input.appId } : {}),
      },
      context,
    );
  }
}

export async function executeMaestroCopyTextFrom(
  params: {
    selector?: MaestroDispatchSelector;
    fallbackText?: string;
  },
  context: MaestroRuntimeOperationContext,
  invokeMutation: InvokeMutation,
): Promise<void> {
  let text = params.fallbackText ?? '';
  if (params.selector) {
    const data = await invokeMutation({ kind: 'getText', selector: params.selector }, context);
    const value = data?.text;
    if (typeof value !== 'string') {
      throw new AppError('COMMAND_FAILED', 'Maestro copyTextFrom did not return text.');
    }
    text = value;
  }
  registerDiagnosticSensitiveValue(text);
  await invokeMutation({ kind: 'clipboardWrite', text }, context);
}

export async function executeMaestroSetClipboard(
  text: string,
  context: MaestroRuntimeOperationContext,
  invokeMutation: InvokeMutation,
): Promise<void> {
  registerDiagnosticSensitiveValue(text);
  await invokeMutation({ kind: 'clipboardWrite', text }, context);
}

export async function executeMaestroPasteText(
  context: MaestroRuntimeOperationContext,
  invokeMutation: InvokeMutation,
  typeTextAndSettle: TypeTextAndSettle,
): Promise<void> {
  const data = await invokeMutation({ kind: 'clipboardRead' }, context);
  const text = data?.text;
  if (typeof text !== 'string') {
    throw new AppError('COMMAND_FAILED', 'Maestro pasteText could not read clipboard text.');
  }
  await typeTextAndSettle(text, context);
}

export async function executeMaestroTravel(
  input: {
    points: readonly MaestroTravelPoint[];
    speedMps?: number;
  },
  context: MaestroRuntimeOperationContext,
  options: CreateDaemonMaestroRuntimeOperationsOptions,
  invokeMutation: InvokeMutation,
): Promise<void> {
  const points = input.points.map((point, index) => ({
    latitude: requireTravelCoordinate(point.latitude, `travel.points[${index}].latitude`),
    longitude: requireTravelCoordinate(point.longitude, `travel.points[${index}].longitude`),
  }));
  if (points.length === 0) {
    throw new AppError('INVALID_ARGS', 'Maestro travel requires at least one point.');
  }
  const speed = input.speedMps;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    if (index > 0 && speed !== undefined && speed > 0) {
      const previous = points[index - 1]!;
      const distanceM = haversineMeters(previous, point);
      const delayMs = Math.max(0, Math.round((distanceM / speed) * 1000));
      if (delayMs > 0) {
        await options.dependencies.sleep(delayMs, context.signal);
      }
    }
    await invokeMutation(
      { kind: 'setLocation', latitude: point.latitude, longitude: point.longitude },
      context,
    );
  }
}

export async function executeMaestroInputRandom(
  input: { inputType: MaestroInputRandomType; length?: number },
  context: MaestroRuntimeOperationContext,
  typeTextAndSettle: TypeTextAndSettle,
): Promise<void> {
  const text = generateMaestroRandomInput(input.inputType, input.length);
  await typeTextAndSettle(text, context);
}

export function generateMaestroRandomInput(
  inputType: MaestroInputRandomType,
  length?: number,
): string {
  switch (inputType) {
    case 'text':
      return randomAlpha(length ?? 8);
    case 'number':
      return randomDigits(length ?? 6);
    case 'email':
      return `${randomAlpha(6).toLowerCase()}@example.com`;
    case 'personName':
      return pick(PERSON_NAMES);
    case 'cityName':
      return pick(CITY_NAMES);
    case 'countryName':
      return pick(COUNTRY_NAMES);
    case 'colorName':
      return pick(COLOR_NAMES);
  }
}

function requireTravelCoordinate(value: number | string, name: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  throw new AppError('INVALID_ARGS', `Maestro ${name} must resolve to a number.`);
}

function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusM = 6_371_000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function readAndroidAirplaneModeOn(deviceId: string): Promise<boolean> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  try {
    const { stdout } = await execFileAsync(
      'adb',
      ['-s', deviceId, 'shell', 'settings', 'get', 'global', 'airplane_mode_on'],
      { encoding: 'utf8', timeout: 10_000 },
    );
    const value = stdout.trim();
    if (value === '1' || value.toLowerCase() === 'true') return true;
    if (value === '0' || value.toLowerCase() === 'false' || value === 'null' || value === '') {
      return false;
    }
    throw new AppError(
      'COMMAND_FAILED',
      `Unexpected airplane_mode_on value from adb: ${value || '<empty>'}`,
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      'COMMAND_FAILED',
      'Failed to read Android airplane_mode_on for toggleAirplaneMode.',
      {
        cause: error,
        hint: 'Ensure adb can reach the device and settings get global airplane_mode_on works.',
      },
    );
  }
}

const PERSON_NAMES = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Katie Bouman'] as const;
const CITY_NAMES = ['Berlin', 'Lisbon', 'Nairobi', 'Osaka', 'Toronto'] as const;
const COUNTRY_NAMES = ['Canada', 'Germany', 'Japan', 'Kenya', 'Portugal'] as const;
const COLOR_NAMES = ['amber', 'coral', 'indigo', 'teal', 'violet'] as const;

function pick<T extends string>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)]!;
}

function randomAlpha(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let out = '';
  for (let i = 0; i < Math.max(1, Math.trunc(length)); i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return out;
}

function randomDigits(length: number): string {
  let out = '';
  for (let i = 0; i < Math.max(1, Math.trunc(length)); i += 1) {
    out += String(Math.floor(Math.random() * 10));
  }
  return out;
}
