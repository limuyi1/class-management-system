import { config } from '@vue/test-utils'

config.global.stubs = {
  ...config.global.stubs,
  'font-awesome-icon': true
}
