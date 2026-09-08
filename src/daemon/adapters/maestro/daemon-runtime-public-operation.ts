import type { CommandFlags } from '@agent-device/contracts/command';
import type {
  MaestroDispatchSelector,
  MaestroSinglePointerGestureInput,
} from '@agent-device/maestro';
import type { DaemonRequest } from '../../daemon-request.ts';
import type { Point, Rect } from '@agent-device/kernel/snapshot';

export type MaestroClickOptions = Pick<
  CommandFlags,
  'count' | 'intervalMs' | 'doubleTap' | 'holdMs'
>;

export type MaestroPublicOperation =
  | {
      kind: 'launchApp';
      appId?: string;
      relaunch: boolean;
      clearState: boolean;
      launchArgs: string[];
    }
  | { kind: 'stopApp'; appId?: string }
  | { kind: 'clearState'; appId?: string }
  | { kind: 'clearKeychain' }
  | { kind: 'openLink'; appId?: string; link: string; prewarmRunner: boolean }
  | { kind: 'setLocation'; latitude: number; longitude: number }
  | { kind: 'setOrientation'; orientation: string }
  | { kind: 'setAirplaneMode'; enabled: boolean }
  | {
      kind: 'setPermission';
      action: 'grant' | 'deny' | 'reset';
      permission: string;
      appId?: string;
    }
  | { kind: 'getText'; selector: MaestroDispatchSelector }
  | { kind: 'clipboardWrite'; text: string }
  | { kind: 'clipboardRead' }
  | { kind: 'typeText'; text: string }
  | {
      kind: 'clickSelector';
      selector: MaestroDispatchSelector;
      expectedPoint: Point;
      options: MaestroClickOptions;
    }
  | { kind: 'clickPoint'; point: Point; options: MaestroClickOptions }
  | { kind: 'swipe'; gesture: MaestroSinglePointerGestureInput; viewport?: Rect }
  | { kind: 'scroll'; direction: string; durationMs?: number }
  | { kind: 'pressKey'; key: 'back' | 'home' | 'enter' | 'return' | 'dismiss' }
  | { kind: 'screenshot'; path: string; stabilize?: boolean; captureBackend?: 'runner' }
  | { kind: 'snapshot' }
  | { kind: 'gestureViewport' };

export type ProjectedMaestroPublicOperation = Pick<DaemonRequest, 'command' | 'positionals'> & {
  input?: Record<string, unknown>;
  flags?: Partial<CommandFlags>;
  internal?: DaemonRequest['internal'];
};

export function projectMaestroPublicOperation(
  operation: MaestroPublicOperation,
): ProjectedMaestroPublicOperation {
  if (operation.kind === 'clearState') return projectClearState(operation);
  if (operation.kind === 'clearKeychain') return projectClearKeychain();
  if (operation.kind === 'setLocation') return projectSetLocation(operation);
  if (operation.kind === 'setOrientation') return projectSetOrientation(operation);
  if (operation.kind === 'setAirplaneMode') return projectSetAirplaneMode(operation);
  if (operation.kind === 'setPermission') return projectSetPermission(operation);
  if (operation.kind === 'getText') return projectGetText(operation);
  if (operation.kind === 'clipboardWrite') {
    return { command: 'clipboard', positionals: ['write', operation.text] };
  }
  if (operation.kind === 'clipboardRead') {
    return { command: 'clipboard', positionals: ['read'] };
  }
  if (isAppOperation(operation)) return projectAppOperation(operation);
  if (isCaptureOperation(operation)) return projectCaptureOperation(operation);
  return projectInputOperation(operation);
}

type MaestroAppOperation = Extract<
  MaestroPublicOperation,
  { kind: 'launchApp' | 'stopApp' | 'openLink' }
>;

function isAppOperation(operation: MaestroPublicOperation): operation is MaestroAppOperation {
  return (
    operation.kind === 'launchApp' || operation.kind === 'stopApp' || operation.kind === 'openLink'
  );
}

function projectAppOperation(operation: MaestroAppOperation): ProjectedMaestroPublicOperation {
  switch (operation.kind) {
    case 'launchApp':
      return projectLaunchApp(operation);
    case 'stopApp':
      return projectStopApp(operation);
    case 'openLink':
      return projectOpenLink(operation);
  }
}

function projectLaunchApp(
  operation: Extract<MaestroAppOperation, { kind: 'launchApp' }>,
): ProjectedMaestroPublicOperation {
  return {
    command: 'open',
    positionals: operation.appId ? [operation.appId] : [],
    flags: {
      ...(operation.relaunch ? { relaunch: true } : {}),
      ...(operation.clearState ? { clearAppState: true } : {}),
      ...(operation.launchArgs.length > 0 ? { launchArgs: operation.launchArgs } : {}),
    },
  };
}

function projectStopApp(
  operation: Extract<MaestroAppOperation, { kind: 'stopApp' }>,
): ProjectedMaestroPublicOperation {
  return {
    command: 'close',
    positionals: operation.appId ? [operation.appId] : [],
    internal: { closeAppOnly: true },
  };
}

function projectClearState(
  operation: Extract<MaestroPublicOperation, { kind: 'clearState' }>,
): ProjectedMaestroPublicOperation {
  return {
    command: 'settings',
    positionals: operation.appId ? ['clear-app-state', operation.appId] : ['clear-app-state'],
  };
}

function projectClearKeychain(): ProjectedMaestroPublicOperation {
  return {
    command: 'settings',
    positionals: ['reset-keychain', 'clear'],
  };
}

function projectSetLocation(
  operation: Extract<MaestroPublicOperation, { kind: 'setLocation' }>,
): ProjectedMaestroPublicOperation {
  return {
    command: 'settings',
    positionals: ['location', 'set', String(operation.latitude), String(operation.longitude)],
  };
}

function projectSetOrientation(
  operation: Extract<MaestroPublicOperation, { kind: 'setOrientation' }>,
): ProjectedMaestroPublicOperation {
  return {
    command: 'orientation',
    positionals: [operation.orientation],
  };
}

function projectSetAirplaneMode(
  operation: Extract<MaestroPublicOperation, { kind: 'setAirplaneMode' }>,
): ProjectedMaestroPublicOperation {
  return {
    command: 'settings',
    positionals: ['airplane', operation.enabled ? 'on' : 'off'],
  };
}

function projectSetPermission(
  operation: Extract<MaestroPublicOperation, { kind: 'setPermission' }>,
): ProjectedMaestroPublicOperation {
  // Permission mutations use the active session app (same as public settings permission).
  void operation.appId;
  return {
    command: 'settings',
    positionals: ['permission', operation.action, operation.permission],
  };
}

function projectGetText(
  operation: Extract<MaestroPublicOperation, { kind: 'getText' }>,
): ProjectedMaestroPublicOperation {
  return {
    command: 'get',
    positionals: [
      'text',
      `${operation.selector.key}=${JSON.stringify(operation.selector.value)}`,
    ],
  };
}

function projectOpenLink(
  operation: Extract<MaestroAppOperation, { kind: 'openLink' }>,
): ProjectedMaestroPublicOperation {
  return {
    command: 'open',
    positionals: operation.appId ? [operation.appId, operation.link] : [operation.link],
    ...(operation.prewarmRunner ? { flags: { maestro: { prewarmRunnerBeforeOpen: true } } } : {}),
  };
}

type MaestroDeviceUtilityOperation = Extract<
  MaestroPublicOperation,
  | { kind: 'clearState' }
  | { kind: 'clearKeychain' }
  | { kind: 'setLocation' }
  | { kind: 'setOrientation' }
  | { kind: 'setAirplaneMode' }
  | { kind: 'setPermission' }
  | { kind: 'getText' }
  | { kind: 'clipboardWrite' }
  | { kind: 'clipboardRead' }
>;

type MaestroInputOperation = Exclude<
  MaestroPublicOperation,
  MaestroAppOperation | MaestroCaptureOperation | MaestroDeviceUtilityOperation
>;

function projectInputOperation(operation: MaestroInputOperation): ProjectedMaestroPublicOperation {
  switch (operation.kind) {
    case 'gestureViewport':
      return { command: 'runtime', positionals: ['gesture-viewport'] };
    case 'typeText':
      return { command: 'type', positionals: [operation.text] };
    case 'clickSelector':
      return projectSelectorClick(operation);
    case 'clickPoint':
      return projectPointClick(operation);
    case 'swipe':
      return projectSwipe(operation);
    case 'scroll':
      return projectScroll(operation);
    case 'pressKey':
      return projectPressKey(operation);
  }
}

function projectSelectorClick(
  operation: Extract<MaestroInputOperation, { kind: 'clickSelector' }>,
): ProjectedMaestroPublicOperation {
  return {
    command: 'click',
    positionals: [`${operation.selector.key}=${JSON.stringify(operation.selector.value)}`],
    flags: {
      ...operation.options,
      maestro: {
        allowNonHittableCoordinateFallback: true,
        expectedTapPoint: operation.expectedPoint,
      },
    },
  };
}

function projectPointClick(
  operation: Extract<MaestroInputOperation, { kind: 'clickPoint' }>,
): ProjectedMaestroPublicOperation {
  return {
    command: 'click',
    positionals: [String(operation.point.x), String(operation.point.y)],
    flags: {
      ...operation.options,
    },
  };
}

function projectSwipe(
  operation: Extract<MaestroInputOperation, { kind: 'swipe' }>,
): ProjectedMaestroPublicOperation {
  const { from, to, durationMs } = operation.gesture;
  return {
    command: 'gesture',
    positionals: [],
    input: {
      kind: 'pan',
      origin: from,
      delta: { x: to.x - from.x, y: to.y - from.y },
      durationMs,
    },
    flags: { postGestureStabilization: false },
    internal: {
      gestureExecutionProfile: 'endpoint-hold',
      ...(operation.viewport ? { gestureViewport: operation.viewport } : {}),
    },
  };
}

function projectScroll(
  operation: Extract<MaestroInputOperation, { kind: 'scroll' }>,
): ProjectedMaestroPublicOperation {
  return {
    command: 'scroll',
    positionals: [operation.direction],
    ...(operation.durationMs === undefined
      ? {}
      : { input: { direction: operation.direction, durationMs: operation.durationMs } }),
    flags: { postGestureStabilization: false },
  };
}

function projectPressKey(
  operation: Extract<MaestroInputOperation, { kind: 'pressKey' }>,
): ProjectedMaestroPublicOperation {
  if (operation.key === 'back' || operation.key === 'home') {
    return { command: operation.key, positionals: [] };
  }
  return { command: 'keyboard', positionals: [operation.key] };
}

type MaestroCaptureOperation = Extract<MaestroPublicOperation, { kind: 'screenshot' | 'snapshot' }>;

function isCaptureOperation(
  operation: MaestroPublicOperation,
): operation is MaestroCaptureOperation {
  return operation.kind === 'screenshot' || operation.kind === 'snapshot';
}

function projectCaptureOperation(
  operation: MaestroCaptureOperation,
): ProjectedMaestroPublicOperation {
  switch (operation.kind) {
    case 'screenshot':
      return {
        command: 'screenshot',
        positionals: [operation.path],
        ...(operation.stabilize === false || operation.captureBackend === 'runner'
          ? {
              flags: {
                ...(operation.stabilize === false ? { screenshotNoStabilize: true } : {}),
                ...(operation.captureBackend === 'runner'
                  ? { maestro: { screenshotCaptureBackend: 'runner' as const } }
                  : {}),
              },
            }
          : {}),
      };
    case 'snapshot':
      return {
        command: 'snapshot',
        positionals: [],
        flags: { noRecord: true },
      };
  }
}
