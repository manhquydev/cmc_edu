// jest-dom matchers (toBeInTheDocument, etc.). Import-only side effect:
// registers matchers via expect.extend, touches no DOM globals at load, so it
// is safe under the node-env logic tests too.
import '@testing-library/jest-dom';
