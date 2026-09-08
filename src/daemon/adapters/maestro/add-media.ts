import path from 'node:path';
import { access } from 'node:fs/promises';
import { AppError } from '@agent-device/kernel/errors';
import { isIosFamily, type DeviceInfo } from '@agent-device/kernel/device';
import { requireExecSuccess } from '@agent-device/host-kit/command';
import { runAndroidAdb } from '@agent-device/platform-android';
import { runSimctl } from '@agent-device/platform-apple/simctl';
import { requireSimulatorDevice } from '@agent-device/platform-apple/simulator';

const ANDROID_MEDIA_DIR = '/sdcard/DCIM/Camera';

export async function addMaestroMediaFiles(params: {
  readonly device: DeviceInfo;
  readonly platform: 'ios' | 'android';
  readonly files: readonly string[];
  readonly sourcePath?: string;
}): Promise<void> {
  if (params.files.length === 0) {
    throw new AppError('INVALID_ARGS', 'Maestro addMedia requires at least one file path.');
  }
  const resolved = await Promise.all(
    params.files.map((file) => resolveMediaFilePath(file, params.sourcePath)),
  );
  if (params.platform === 'ios') {
    await addIosSimulatorMedia(params.device, resolved);
    return;
  }
  await addAndroidDeviceMedia(params.device, resolved);
}

async function addIosSimulatorMedia(device: DeviceInfo, files: readonly string[]): Promise<void> {
  if (!isIosFamily(device)) {
    throw new AppError('UNSUPPORTED_PLATFORM', 'Maestro addMedia on iOS requires an Apple device.');
  }
  requireSimulatorDevice(device, 'addMedia');
  requireExecSuccess(
    await runSimctl(device, ['addmedia', device.id, ...files]),
    'simctl addmedia failed',
  );
}

async function addAndroidDeviceMedia(device: DeviceInfo, files: readonly string[]): Promise<void> {
  if (device.platform !== 'android') {
    throw new AppError(
      'UNSUPPORTED_PLATFORM',
      'Maestro addMedia on Android requires an Android device.',
    );
  }
  requireExecSuccess(
    await runAndroidAdb(device, ['shell', 'mkdir', '-p', ANDROID_MEDIA_DIR]),
    'adb mkdir for media failed',
  );
  for (const file of files) {
    const remotePath = `${ANDROID_MEDIA_DIR}/${path.basename(file)}`;
    requireExecSuccess(
      await runAndroidAdb(device, ['push', file, remotePath]),
      `adb push failed for ${path.basename(file)}`,
    );
    requireExecSuccess(
      await runAndroidAdb(device, [
        'shell',
        'am',
        'broadcast',
        '-a',
        'android.intent.action.MEDIA_SCANNER_SCAN_FILE',
        '-d',
        `file://${remotePath}`,
      ]),
      `media scan failed for ${path.basename(file)}`,
    );
  }
}

async function resolveMediaFilePath(file: string, sourcePath: string | undefined): Promise<string> {
  const resolved = path.isAbsolute(file)
    ? file
    : sourcePath
      ? path.resolve(path.dirname(sourcePath), file)
      : path.resolve(file);
  try {
    await access(resolved);
  } catch {
    throw new AppError('INVALID_ARGS', `Maestro addMedia file not found: ${file}`, {
      path: resolved,
    });
  }
  return resolved;
}
