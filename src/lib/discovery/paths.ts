export function isDiscoveryPath(pathname: string): boolean {
  return (
    pathname === '/discovery' ||
    pathname.startsWith('/discovery/') ||
    pathname === '/en/discovery' ||
    pathname.startsWith('/en/discovery/') ||
    pathname === '/it/discovery' ||
    pathname.startsWith('/it/discovery/')
  );
}
