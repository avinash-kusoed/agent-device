export type MaestroScalar = string | number | boolean | null;

export type MaestroSourceLocation = {
  path?: string;
  line: number;
};

export type MaestroPlatform = 'android' | 'ios' | 'web';

export type MaestroDirection = 'up' | 'down' | 'left' | 'right';

export type MaestroCoordinate =
  | { space: 'absolute'; x: number; y: number }
  | { space: 'percent'; x: number; y: number };

export type MaestroLeafSelector = {
  text?: string;
  id?: string;
  enabled?: boolean;
  selected?: boolean;
  optional?: boolean;
};

export type MaestroRelationalSelectorFields = {
  index?: number | string;
  childOf?: MaestroSelector;
  below?: MaestroSelector;
  above?: MaestroSelector;
  leftOf?: MaestroSelector;
  rightOf?: MaestroSelector;
  containsChild?: MaestroSelector;
  containsDescendants?: MaestroSelector[];
};

export type MaestroSelectorMap = MaestroLeafSelector & MaestroRelationalSelectorFields;

export type MaestroSelector = MaestroSelectorMap;

export type MaestroOptionalCommand = {
  optional?: boolean;
};

export type MaestroGestureTarget =
  | MaestroCoordinate
  | { space: 'target'; selector: MaestroSelector };

export type MaestroLaunchArguments =
  | { kind: 'scalar'; value: string | number | boolean }
  | { kind: 'list'; values: Array<string | number | boolean> }
  | { kind: 'map'; values: Record<string, string | number | boolean> };

export type MaestroLaunchAppCommand = {
  kind: 'launchApp';
  source: MaestroSourceLocation;
  appId?: string;
  stopApp?: boolean;
  clearState?: boolean;
  clearKeychain?: boolean;
  arguments?: MaestroLaunchArguments;
  launchArguments?: MaestroLaunchArguments;
};

export type MaestroTapOnCommand = MaestroOptionalCommand & {
  kind: 'tapOn';
  source: MaestroSourceLocation;
  target: MaestroGestureTarget;
  retryTapIfNoChange?: boolean;
  repeat?: number | string;
  delay?: number | string;
  waitToSettleTimeoutMs?: number | string;
  label?: string;
};

export type MaestroDoubleTapOnCommand = MaestroOptionalCommand & {
  kind: 'doubleTapOn';
  source: MaestroSourceLocation;
  target: MaestroGestureTarget;
  delay?: number | string;
  retryTapIfNoChange?: boolean;
  label?: string;
};

export type MaestroLongPressOnCommand = MaestroOptionalCommand & {
  kind: 'longPressOn';
  source: MaestroSourceLocation;
  target: MaestroGestureTarget;
  label?: string;
};

export type MaestroSwipeGesture =
  | {
      kind: 'coordinates';
      start: MaestroCoordinate;
      end: MaestroCoordinate;
      duration?: number | string;
    }
  | {
      kind: 'screen';
      direction: MaestroDirection;
      duration?: number | string;
    }
  | {
      kind: 'target';
      from: MaestroSelector;
      direction: MaestroDirection;
      duration?: number | string;
    };

export type MaestroSwipeCommand = MaestroOptionalCommand & {
  kind: 'swipe';
  source: MaestroSourceLocation;
  gesture: MaestroSwipeGesture;
  label?: string;
};

export type MaestroInputTextCommand = {
  kind: 'inputText';
  source: MaestroSourceLocation;
  text: string;
  label?: string;
};

export type MaestroEraseTextCommand = {
  kind: 'eraseText';
  source: MaestroSourceLocation;
  charactersToErase?: number | string;
};

export type MaestroOpenLinkCommand = {
  kind: 'openLink';
  source: MaestroSourceLocation;
  link: string;
};

export type MaestroAssertVisibleCommand = MaestroOptionalCommand & {
  kind: 'assertVisible';
  source: MaestroSourceLocation;
  target: MaestroSelector;
  label?: string;
};

export type MaestroAssertNotVisibleCommand = MaestroOptionalCommand & {
  kind: 'assertNotVisible';
  source: MaestroSourceLocation;
  target: MaestroSelector;
  label?: string;
};

export type MaestroAssertTrueCommand = MaestroOptionalCommand & {
  kind: 'assertTrue';
  source: MaestroSourceLocation;
  condition: string | number | boolean;
  label?: string;
};

export type MaestroExtendedWaitUntilCommand = MaestroOptionalCommand & {
  kind: 'extendedWaitUntil';
  source: MaestroSourceLocation;
  visible?: MaestroSelector;
  notVisible?: MaestroSelector;
  timeout?: number | string;
  label?: string;
};

export type MaestroTakeScreenshotCommand = {
  kind: 'takeScreenshot';
  source: MaestroSourceLocation;
  path: string;
};

export type MaestroScrollCommand = {
  kind: 'scroll';
  source: MaestroSourceLocation;
};

export type MaestroScrollUntilVisibleCommand = MaestroOptionalCommand & {
  kind: 'scrollUntilVisible';
  source: MaestroSourceLocation;
  element: MaestroSelector;
  direction?: MaestroDirection;
  timeout?: number | string;
  speed?: number | string;
  visibilityPercentage?: number | string;
  label?: string;
};

export type MaestroHideKeyboardCommand = {
  kind: 'hideKeyboard';
  source: MaestroSourceLocation;
};

export type MaestroPressKeyName = 'back' | 'enter' | 'return' | 'home' | 'backspace' | 'tab';

export type MaestroPressKeyCommand = {
  kind: 'pressKey';
  source: MaestroSourceLocation;
  key: MaestroPressKeyName;
};

export type MaestroBackCommand = {
  kind: 'back';
  source: MaestroSourceLocation;
};

export type MaestroWaitForAnimationToEndCommand = {
  kind: 'waitForAnimationToEnd';
  source: MaestroSourceLocation;
  timeout?: number | string;
};

export type MaestroStopAppCommand = {
  kind: 'stopApp';
  source: MaestroSourceLocation;
  appId?: string;
};

export type MaestroClearStateCommand = {
  kind: 'clearState';
  source: MaestroSourceLocation;
  appId?: string;
};

export type MaestroClearKeychainCommand = {
  kind: 'clearKeychain';
  source: MaestroSourceLocation;
};

export type MaestroAddMediaCommand = {
  kind: 'addMedia';
  source: MaestroSourceLocation;
  files: string[];
};

export type MaestroKillAppCommand = {
  kind: 'killApp';
  source: MaestroSourceLocation;
  appId?: string;
};

export type MaestroSetLocationCommand = {
  kind: 'setLocation';
  source: MaestroSourceLocation;
  latitude: number | string;
  longitude: number | string;
};

export type MaestroOrientationName =
  | 'portrait'
  | 'landscape-left'
  | 'landscape-right'
  | 'portrait-upside-down';

export type MaestroSetOrientationCommand = {
  kind: 'setOrientation';
  source: MaestroSourceLocation;
  orientation: MaestroOrientationName;
};

export type MaestroAirplaneModeValue = 'enabled' | 'disabled';

export type MaestroSetAirplaneModeCommand = {
  kind: 'setAirplaneMode';
  source: MaestroSourceLocation;
  value: MaestroAirplaneModeValue;
};

export type MaestroToggleAirplaneModeCommand = {
  kind: 'toggleAirplaneMode';
  source: MaestroSourceLocation;
};

export type MaestroPermissionAction = 'grant' | 'deny' | 'reset';

export type MaestroPermissionTarget =
  | 'camera'
  | 'microphone'
  | 'photos'
  | 'contacts'
  | 'contacts-limited'
  | 'notifications'
  | 'calendar'
  | 'location'
  | 'location-always'
  | 'media-library'
  | 'motion'
  | 'reminders'
  | 'siri'
  | 'accessibility'
  | 'screen-recording'
  | 'input-monitoring';

export type MaestroPermissionGrant = {
  target: MaestroPermissionTarget;
  action: MaestroPermissionAction;
};

export type MaestroSetPermissionsCommand = {
  kind: 'setPermissions';
  source: MaestroSourceLocation;
  appId?: string;
  grants: MaestroPermissionGrant[];
};

export type MaestroCopyTextFromCommand = {
  kind: 'copyTextFrom';
  source: MaestroSourceLocation;
  target: MaestroSelector;
  label?: string;
};

export type MaestroSetClipboardCommand = {
  kind: 'setClipboard';
  source: MaestroSourceLocation;
  text: string;
  label?: string;
};

export type MaestroPasteTextCommand = {
  kind: 'pasteText';
  source: MaestroSourceLocation;
  label?: string;
};

export type MaestroTravelPoint = {
  latitude: number | string;
  longitude: number | string;
};

export type MaestroTravelCommand = {
  kind: 'travel';
  source: MaestroSourceLocation;
  points: MaestroTravelPoint[];
  speed?: number | string;
};

export type MaestroInputRandomType =
  | 'text'
  | 'number'
  | 'email'
  | 'personName'
  | 'cityName'
  | 'countryName'
  | 'colorName';

export type MaestroInputRandomCommand = {
  kind: 'inputRandom';
  source: MaestroSourceLocation;
  inputType: MaestroInputRandomType;
  length?: number | string;
  label?: string;
};

export type MaestroRunScriptCommand = {
  kind: 'runScript';
  source: MaestroSourceLocation;
  file: string;
  env?: Record<string, string | number | boolean>;
};

export type MaestroRunFlowCondition = {
  platform?: MaestroPlatform;
  visible?: MaestroSelector;
  notVisible?: MaestroSelector;
  true?: boolean | string;
};

export type MaestroRunFlowCommand = {
  kind: 'runFlow';
  source: MaestroSourceLocation;
  include: { kind: 'file'; path: string } | { kind: 'commands'; commands: MaestroCommand[] };
  when?: MaestroRunFlowCondition;
  env?: Record<string, string | number | boolean>;
  label?: string;
};

export type MaestroRepeatWhileCondition = {
  mode: 'visible' | 'notVisible';
  selector: MaestroSelector;
};

export type MaestroRepeatCommand = {
  kind: 'repeat';
  source: MaestroSourceLocation;
  times?: number | string;
  while?: MaestroRepeatWhileCondition;
  commands: MaestroCommand[];
};

export type MaestroRetryCommand = {
  kind: 'retry';
  source: MaestroSourceLocation;
  maxRetries?: number | string;
  commands: MaestroCommand[];
};

export type MaestroCommand =
  | MaestroLaunchAppCommand
  | MaestroTapOnCommand
  | MaestroDoubleTapOnCommand
  | MaestroLongPressOnCommand
  | MaestroSwipeCommand
  | MaestroInputTextCommand
  | MaestroEraseTextCommand
  | MaestroOpenLinkCommand
  | MaestroAssertVisibleCommand
  | MaestroAssertNotVisibleCommand
  | MaestroAssertTrueCommand
  | MaestroExtendedWaitUntilCommand
  | MaestroTakeScreenshotCommand
  | MaestroScrollCommand
  | MaestroScrollUntilVisibleCommand
  | MaestroHideKeyboardCommand
  | MaestroPressKeyCommand
  | MaestroBackCommand
  | MaestroWaitForAnimationToEndCommand
  | MaestroStopAppCommand
  | MaestroClearStateCommand
  | MaestroClearKeychainCommand
  | MaestroAddMediaCommand
  | MaestroKillAppCommand
  | MaestroSetLocationCommand
  | MaestroSetOrientationCommand
  | MaestroSetAirplaneModeCommand
  | MaestroToggleAirplaneModeCommand
  | MaestroSetPermissionsCommand
  | MaestroCopyTextFromCommand
  | MaestroSetClipboardCommand
  | MaestroPasteTextCommand
  | MaestroTravelCommand
  | MaestroInputRandomCommand
  | MaestroRunScriptCommand
  | MaestroRunFlowCommand
  | MaestroRepeatCommand
  | MaestroRetryCommand;

export type MaestroProgramConfig = {
  name?: string;
  appId?: string;
  tags?: string[];
  env?: Record<string, string | number | boolean>;
  onFlowStart?: MaestroCommand[];
  onFlowComplete?: MaestroCommand[];
};

export type MaestroProgram = {
  kind: 'program';
  source: MaestroSourceLocation;
  config: MaestroProgramConfig;
  commands: MaestroCommand[];
};

export type MaestroProgramParseOptions = {
  sourcePath?: string;
};
