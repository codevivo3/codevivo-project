import { validateDiscoveryPepper } from '../src/lib/discovery/credential-core';
import { discoveryTokenPeppersMatch } from './discovery-admin-validation';
import {
  DISCOVERY_PEPPER_SERVICE,
  readKeychainSecret,
} from './discovery-keychain';

const localPepper = validateDiscoveryPepper(
  readKeychainSecret(DISCOVERY_PEPPER_SERVICE),
);
const deployedPepper = validateDiscoveryPepper(
  process.env.DISCOVERY_TOKEN_PEPPER,
);

if (!discoveryTokenPeppersMatch(localPepper, deployedPepper)) {
  throw new Error('Discovery token pepper alignment failed');
}

console.log('Discovery token pepper alignment: MATCH');
