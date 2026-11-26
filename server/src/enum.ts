export enum SquintEnvironment {
  Development = 'development',
  Testing = 'testing',
  Production = 'production',
}

export enum UserRole {
  Approver = 'approver',
  Viewer = 'viewer',
}

export enum BuildKind {
  Main = 'main',
  PullRequest = 'pull-request',
  Release = 'release',
}

export enum BuildStatus {
  Pending = 'pending',
  Complete = 'complete',
}

export enum ScreenshotTheme {
  Light = 'light',
  Dark = 'dark',
}

export enum ScreenshotStatus {
  Unchanged = 'unchanged',
  Changed = 'changed',
  New = 'new',
  Removed = 'removed',
}

export enum ReviewStatus {
  NeedsReview = 'needs-review',
  Approved = 'approved',
  Unchanged = 'unchanged',
}

export enum PullRequestState {
  Open = 'open',
  Closed = 'closed',
  Merged = 'merged',
}

export enum GithubEvent {
  Ping = 'ping',
  PullRequest = 'pull_request',
}

export enum GithubHeader {
  Event = 'x-github-event',
  Signature = 'x-hub-signature-256',
}

export enum ReleaseNoteKind {
  Feature = 'feature',
  Fix = 'fix',
}

export enum WebsocketEvent {
  Change = 'change',
}

export enum MetadataKey {
  AuthRoute = 'auth_route',
}

export enum ApiTag {
  Authentication = 'Authentication',
  Blobs = 'Blobs',
  Builds = 'Builds',
  Dashboard = 'Dashboard',
  Github = 'GitHub',
  Projects = 'Projects',
  Releases = 'Releases',
  Screens = 'Screens',
  Server = 'Server',
  Users = 'Users',
}
