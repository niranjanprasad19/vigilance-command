// Runtime accessors for current mode/role so non-React modules
// (decision engine, telemetry helpers) can adapt without React imports.

import type { Role } from "./rbac";
import type { OpsMode } from "./ops-context";

let _mode: OpsMode = "TRAINING";
let _role: Role = "operator";

export function setOpsRuntime(mode: OpsMode, role: Role) {
  _mode = mode;
  _role = role;
}
export function getOpsMode(): OpsMode { return _mode; }
export function getOpsRole(): Role { return _role; }
