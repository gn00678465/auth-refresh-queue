import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'lib',
  stylistic: true,
  gitignore: true,
  typescript: true,
  yaml: false,
  markdown: false,
  ignores: [
    'tsdown.config.ts',
  ],
})
