import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// React Testing Library does not unmount automatically between tests.
afterEach(() => {
  cleanup()
})
